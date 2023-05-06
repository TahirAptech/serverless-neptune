const { buildResponse } = require("../util/ApiResponse");
const validateJson = require('jsonschema');
const validator = validateJson.Validator;
const { runNeptuneQuery } = require("../util/neptune");

module.exports.credential = async (obj) => {
    try {
        console.time("Lambda Process time")
        if (conn == null) {
            console.log("initializing neptune connection")
            conn = createRemoteConnection();
        }

        const err = validateQueryStringParamters(obj);
        console.log("> Validate Error", err);
        if (err.errors.length) {
            return buildResponse({ message: "invalid payload" }, 400);
        }

        const { cre, hash } = obj;

        const firstQ = `g.addV('Wallet').property('id', '${hash}')`;
        await runNeptuneQuery(conn, firstQ);

        const queryCredential = `g.addV('Credential')` +
            `.property('id', '${cre.id}')` +
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