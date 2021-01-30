const { init } = absoluteRequire("controllers/videoCall");

const express = require("express");

const { Router } = express;

const route = Router();

route.post("/secured/videoCall", init);

module.exports = route;
