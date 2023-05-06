const { buildResponse } = require("../util/ApiResponse");
const { company } = require("./company");
const { credential } = require("./credential");

module.exports.handler = async (event) => {
  const req = JSON.parse(event.body);

  switch (req.type) {
    case "company":
      await company(req);
      break;
    case "credential":
      await credential(req);
      break;
    default:
      return buildResponse({ message: "invalid payload" }, 400);
  }
};