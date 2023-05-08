const { buildResponse } = require("../util/ApiResponse");
const validateJson = require('jsonschema');
const validator = validateJson.Validator;
const { runNeptuneQuery } = require("../util/neptune");

module.exports.company = async (obj) => {
    try {
        console.time("Lambda Process time")

        const err = validateQueryStringParamters(obj);
        console.log("> Validate Error", err);
        if (err.errors.length) {
            return buildResponse({ message: "invalid payload" }, 400);
        }

        const { company, hash } = obj;

        // const firstQ = `g.addV('Wallet').property('id', '${hash}')`;
        const firstQ = `g.V().has('Wallet', 'id', '${hash}').fold().coalesce(unfold(), addV('Wallet').property('id', '${hash}'))`;

        await runNeptuneQuery(firstQ);

        const queryCompany = `g.V().has('Company', 'id', '${company.id}').fold()` +
            `.coalesce(unfold(),` +
            `addV('Company')` +
            `.property('id', '${company.id}')` +
            `.property('type', ${company.company})` +
            `.property('email', '${company.email}')` +
            `.property('name', '${company.name}')` +
            `.property('address', '${company.address}')` +
            `.property('website', '${company.website}')` +
            `.property('twitter', '${company.twitter}')` +
            `.property('instagram', '${company.instagram}')` +
            `.property('facebook', '${company.facebook}')` +
            `.property('linkedin', '${company.linkedin}')` +
            `).as('company')` +
            `.V().has('Wallet', 'id', '${hash}')` +
            `.coalesce(outE('OWNS').where(inV().as('company')),` +
            ` addE('OWNS').to('company'))`;
        await runNeptuneQuery(queryCompany);

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
};

const validateQueryStringParamters = (requestBody) => {
    let v = new validator()
    const schema = {
        type: 'object',
        required: ['hash'],
        properties: {
            type: {
                type: 'string'
            },
            company: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string'
                    },
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
            hash: {
                type: 'string'
            }
        },
        additionalProperties: false
    };

    return v.validate(requestBody, schema);
}