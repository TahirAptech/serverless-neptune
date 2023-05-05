let { driver } = require("gremlin");
const async = require("async");
const { v4: uuid } = require("uuid")
const validateJson = require('jsonschema');
let conn;
const validator = validateJson.Validator;

module.exports.handler = async (event) => {
  try {
    console.time("Lambda Process time")
    if (conn == null) {
      console.log("initializing neptune connection")
      conn = createRemoteConnection();
    }
    const obj = JSON.parse(event.body);

    const err = validateQueryStringParamters(obj);
    console.log("> Validate Error",err);
    if (err.errors.length) {
      return buildResponse({ message: "invalid payload" }, 400);
    }
    
    const { company, cre, hash } = obj;
    
    const firstQ = `g.addV('Wallet').property('id', '${hash}')`;
    await runNeptuneQuery(conn, firstQ);

    const queryCompany = "g.addV('Company')" +
      `.property('id', '${uuid()}')` +
      `.property('type', '${company.company}')` +
      `.property('email', '${company.email}')` +
      `.property('name', '${company.name}')` +
      `.property('address', '${company.address}')` +
      `.property('website', '${company.website}')` +
      `.property('twitter', '${company.twitter}')` +
      `.property('instagram', '${company.instagram}')` +
      `.property('facebook', '${company.facebook}')` +
      `.property('linkedin', '${company.linkedin}')` +
      `.as('company')` +
      `.V().has('Wallet', 'id', '${hash}')` +
      `.addE('OWNS').to('company')`;
    await runNeptuneQuery(conn, queryCompany);

    const queryCredential = `g.addV('Credential')` +
      `.property('id', '${uuid()}')` +
      `.property('deadline', '${cre.deadline}')` +
      `.property('online', ${cre.online})` +
      `.property('onsite', ${cre.onsite})` +
      `.property('workExperience', ${cre.workExperience})` +
      `.property('assessment', ${cre.assessment})` +
      `.property('qualificationsFrameworkLevel', ${cre.qualificationsFrameworkLevel})` +
      `.property('qualificationsFrameworkText', '${cre.qualificationsFrameworkText}')` +
      `.property('achievementAwardedOn', '${cre.achievementAwardedOn}')` +
      `.as('credential')` +
      `.V().has('Wallet', 'id', '${hash}')` +
      `.addE('OWNS').to('credential')`;
    await runNeptuneQuery(conn, queryCredential);

    const finalQuery = `g.V().has('Wallet', 'id', '${hash}')` +
      `.project('wallet', 'companies', 'credentials')` +
      `.by()` +
      `.by(out('OWNS').hasLabel('Company').valueMap())` +
      `.by(out('OWNS').hasLabel('Credential').valueMap())`;
    console.log("Gremlin Query:", finalQuery);

    const finalQueryResult = await runNeptuneQuery(conn, finalQuery);
    console.log("Gremlin Result:", finalQueryResult);

    console.timeEnd("Lambda Process time")
    
    return buildResponse({ message: "SUCCESSED" });
  }
  catch (err) {
    console.error(err.message);
    return buildResponse({ message: "An internal server error occurred" }, 500);
  }
};

const runNeptuneQuery = async (conn, gremlinTemplate) => {
  return async.retry(
    {
      times: 5,
      interval: 1000,
      errorFilter: function (err) {

        // Add filters here to determine whether error can be retried
        console.warn('determining whether retriable error: ' + err.message);

        // Check for connection issues
        if (err.message.startsWith('WebSocket is not open')) {
          console.warn('reopening connection');
          conn.close();
          conn = createRemoteConnection();
          return true;
        }

        // Check for ConcurrentModificationException
        if (err.message.includes('ConcurrentModificationException')) {
          console.warn('retrying query because of "ConcurrentModificationException"');
          return true;
        }

        // Check for ReadOnlyViolationException
        if (err.message.includes('ReadOnlyViolationException')) {
          console.warn('retrying query because of "ReadOnlyViolationException"');
          return true;
        }

        return false;
      }
    },
    async () => {
      return await doQuery(gremlinTemplate)
    });
}

const getConnectionDetails = () => {
  const neptuneEnv = { // Todo: set neptuneEnv for time being.
    NEPTUNE_PORT: process.env.NEPTUNE_PORT,
    NEPTUNE_ENDPOINT: process.env.NEPTUNE_ENDPOINT
  }
  console.log("neptuneEnv", neptuneEnv);
  const database_url = 'wss://' + neptuneEnv.NEPTUNE_ENDPOINT + ':' + neptuneEnv.NEPTUNE_PORT + '/gremlin';
  return { url: database_url, headers: {} };
};

const createRemoteConnection = () => {
  const { url, headers } = getConnectionDetails();
  const c = new driver.Client(url,
    {
      mimeType: 'application/vnd.gremlin-v2.0+json',
      headers: headers
    })

  return c;
};

async function doQuery(query) {
  const result = await conn.submit(query);
  return result;
}

const validateQueryStringParamters = (requestBody) => {
  let v = new validator()
  const schema = {
    type: 'object',
    required: ['hash'],
    properties: {
      hash: {
        type: 'string'
      },
      company: {
        type: 'object',
        properties: {
          company: {
            type: 'number'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          name: {
            type: 'string'
          },
          address: {
            type: 'string'
          },
          website: {
            type: 'string'
          },
          twitter: {
            type: 'string'
          },
          instagram: {
            type: 'string'
          },
          facebook: {
            type: 'string'
          },
          linkedin: {
            type: 'string'
          }
        }
      },
      cre: {
        type: 'object',
        properties: {
          deadline: {
            type: 'string',
            format: 'date'
          },
          online: {
            type: 'number'
          },
          onsite: {
            type: 'number'
          },
          workExperience: {
            type: 'number'
          },
          assessment: {
            type: 'number'
          },
          qualificationsFrameworkLevel: {
            type: 'number'
          },
          qualificationsFrameworkText: {
            type: 'string'
          },
          achievementAwardedOn: {
            type: 'string',
            format: 'date'
          }
        }
      }
    }
  };

  return v.validate(requestBody, schema);
}

function buildResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body),
  };
}