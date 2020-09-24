const { findOneUser } = absoluteRequire("repositories/user");

const http = require("http");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const socketIO = require("socket.io");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const expressValidator = require("express-validator");
const logger = absoluteRequire("modules/winston");
const constants = absoluteRequire("modules/constants");
const expressRoutes = absoluteRequire("routes");

module.exports = (app) => {
	const userSocketIdMap = new Map();
	const server = http.createServer(app);
	const port =
		process.env.PORT ||
		process.env.OPENSHIFT_NODEJS_PORT ||
		constants.GENERAL.SERVER_HTTP_PORT;

	const httpId =
		process.env.IP ||
		process.env.OPENSHIFT_NODEJS_IP ||
		constants.GENERAL.SERVER_HTTP_IP;

	const corsOptions = {
		origin: (origin, callback) => {
			if (constants.GENERAL.WHITELIST.indexOf(origin) !== -1) {
				callback(null, true);
			} else {
				callback(null, false);
			}
		},
	};

	global.io = socketIO.listen(server);

	app.use(expressValidator());
	app.use(compression());
	app.use(helmet());
	app.use(cors(corsOptions));
	app.use(morgan("dev"));
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());

	expressRoutes(app);

	// HTTP SERVER
	server.listen(port, httpId, () => {
		logger.info(`HTTP Server: Listering on ${httpId}:${port}`);
	});

	// SOCKET.IO SERVER
	global.io.httpServer.on("listening", () => {
		logger.info(`SOCKET.IO Server: Listering on ${httpId}:${port}`);
	});

	global.io.on("connection", (socket) => {
		logger.info("SOCKET.IO Server: New client");

		socket.on("login", (params) => {
			const { token } = params;

			jwt.verify(
				token,
				constants.GENERAL.JWT_SECRET,
				async (err, decodedData) => {
					if (err) {
						logger.error("SOCKET.IO Server: Invalid login token");
						socket.emit("login-error");
					} else {
						const { nickname, _id } = decodedData;

						try {
							const user = await findOneUser({
								nickname,
								_id,
							});

							if (user) {
								socket.join(`${_id}`);
								socket.user_id = _id;
								socket.user_name = nickname;
								addClientToMap(_id, socket.id);
							} else {
								socket.emit("login-error");
							}
						} catch (e) {
							socket.emit("login-error");
						}
					}
				}
			);
		});

		//create call request
		socket.on("request", (params) => {
			if (socket.inCallWith && socket.inCallWith !== "") {
				console.log("ja ligando", socket.inCallWith);
				return;
			}
			socket.inCallWith = params.to;
			global.io.to(params.to).emit("videocall.calling", {
				...params,
			});
		});

		// acept the call
		socket.on("call", (params) => {
			socket.inCallWith = params.to;
			global.io.to(params.to).emit("call", {
				...params,
				// from: logedId, <-- ativar depois caso necessario
			});
		});

		socket.on("end", (params) => {
			global.io.to(params.to).emit("end", {
				to: params.to,
				timeout: params.timeout || false,
			});
		});

		socket.on("isOnline", (params) => {
			console.log("asdadsa");
			if (userSocketIdMap.has(params.userId)) {
				socket.emit("isOnline", {
					status: "online",
				});
			} else {
				socket.emit("isOnline", {
					status: "offline",
				});
			}
		});

		socket.once("disconnect", () => {
			global.io.to(socket.inCallWith).emit("end");
			socket.inCallWith = "";
			removeClientFromMap(socket.user_id, socket.id);
			logger.info("SOCKET.IO Server: Client disconnected");
		});
	});

	function addClientToMap(userId, socketId) {
		if (!userSocketIdMap.has(userId)) {
			//when user is joining first time
			userSocketIdMap.set(userId, new Set([socketId]));
		} else {
			//user had already joined from one client and now joining using another client;
			userSocketIdMap.get(userId).add(socketId);
		}

		console.log(userSocketIdMap);
	}

	function removeClientFromMap(userId, socketID) {
		if (userSocketIdMap.has(userId)) {
			let userSocketIdSet = userSocketIdMap.get(userId);
			userSocketIdSet.delete(socketID);
			//if there are no clients for a user, remove that user from online list(map);
			if (userSocketIdSet.size == 0) {
				userSocketIdMap.delete(userId);
			}
		}
	}

	return server;
};
