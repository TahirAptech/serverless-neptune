const { buildResponse } = require("../util/ApiResponse");
const { company } = require("./company");
const { credential } = require("./credential");

module.exports.handler = async (event) => {
  const req = JSON.parse(event.body);

  switch (req.type) {
    case "company":
      return await company(req);
    case "credential":
      return await credential(req);
    default:
      return buildResponse({ message: "invalid payload" }, 400);
  }
};