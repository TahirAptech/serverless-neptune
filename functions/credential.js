const { buildResponse } = require("../util/ApiResponse");
const validateJson = require('jsonschema');
const validator = validateJson.Validator;
const { runNeptuneQuery } = require("../util/neptune");

module.exports.credential = async (obj) => {
    try {
        console.time("Lambda Process time")

        const err = validateQueryStringParamters(obj);
        console.log("> Validate Error", err);
        if (err.errors.length) {
            return buildResponse({ message: "invalid payload" }, 400);
        }

        const { credential, hash } = obj;

        const firstQ = `g.V().has('Wallet', 'id', '${hash}').fold().coalesce(unfold(), addV('Wallet').property('id', '${hash}'))`;
        await runNeptuneQuery(firstQ);

        const queryCredential = `g.V().has('Credential', 'id', 'credential#${credential.companyId}').fold()` +
            `.coalesce(unfold(),` +
            `addV('Credential')` +
            `.property('id', 'credential#${credential.companyId}')` +
            `.property('deadline', '${credential.deadline}')` +
            `.property('online', ${credential.online})` +
            `.property('onsite', ${credential.onsite})` +
            `.property('workExperience', ${credential.workExperience})` +
            `.property('assessment', ${credential.assessment})` +
            `.property('qualificationsFrameworkLevel', ${credential.qualificationsFrameworkLevel})` +
            `.property('qualificationsFrameworkText', '${credential.qualificationsFrameworkText}')` +
            `.property('achievementAwardedOn', '${credential.achievementAwardedOn}')` +
            `).as('credential')` +
            `.V().has('Wallet', 'id', '${hash}')` +
            `.coalesce(inE('OWNS').where(outV().as('credential')), addE('OWNS').to('credential'))`;

        await runNeptuneQuery(queryCredential);

        const finalQuery = `g.V().has('Wallet', 'id', '${hash}')` +
            `.project('wallet', 'companies', 'credentials')` +
            `.by()` +
            `.by(out('OWNS').hasLabel('Company').valueMap())` +
            `.by(out('OWNS').hasLabel('Credential').valueMap())`;
        console.log("Gremlin Query:", finalQuery);

        const finalQueryResult = await runNeptuneQuery(finalQuery);
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
            type: {
                type: 'string'
            },
            credential: {
                type: 'object',
                properties: {
                    companyId: {
                        type: 'string'
                    },
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
            },
            hash: {
                type: 'string'
            }
        },
        additionalProperties: false
    };

    return v.validate(requestBody, schema);
}