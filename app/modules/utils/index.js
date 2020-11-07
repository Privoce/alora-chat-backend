const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const constants = absoluteRequire("modules/constants");

exports.encryptPassword = (password) =>
	crypto
		.createHmac(process.env.HASH, process.env.SECRET)
		.update(password)
		.digest(process.env.DIGEST);

exports.createJwtToken = (model) =>
	jwt.sign(model, process.env.JWT_SECRET, {
		expiresIn: process.env.JWTEXPIRES_IN,
	});

exports.convertErrorToFrontFormat = (errors) =>
	_.mapValues(errors, (model) => model.msg);
