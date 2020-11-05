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
	const usersInCall = new Map(); // it can be stored on mongoDb too, but...
	const server = http.createServer(app);
	const port = process.env.PORT || process.env.SERVER_HTTP_PORT;

	const httpId =
		process.env.SERVER_HTTP_IP || process.env.OPENSHIFT_NODEJS_IP;

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
				process.env.JWT_SECRET,
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
								console.log("original", _id);
								addClientToMap(_id, socket.id, "online");
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
				return;
			}
			console.log("to aqui");
			socket.inCallWith = params.to;

			// check if partner is in another call
			// and cancel
			if (userSocketIdMap.has(params.to)) {
				console.log("desligar");
				global.io.to(params.to).emit("end", {
					to: params.to,
					timeout: false,
				});
			}

			// add user and partner to "inCall"

			addClientToMap(params.to, params.to, "inCall");
			addClientToMap(params.from._id, socket.id, "inCall");

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
			removeClientFromMap(params.to, params.to, "inCall");
			removeClientFromMap(socket.user_id, socket.id, "inCall");
			global.io.to(params.to).emit("end", {
				to: params.to,
				timeout: params.timeout || false,
			});
		});

		socket.on("isOnline", (params) => {
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

		// when enable or disable video
		socket.on("toggle-video", (params) => {
			console.log(params, "aqui toggle", socket.inCallWith);
			global.io.to(socket.inCallWith).emit("toggle-video", {
				...params,
			});
		});

		socket.once("disconnect", () => {
			global.io.to(socket.inCallWith).emit("end");
			socket.inCallWith = "";
			console.log("saindo com ", socket.user_id);
			removeClientFromMap(socket.user_id, socket.id, "online");
			logger.info("SOCKET.IO Server: Client disconnected");
		});
	});

	function addClientToMap(userId, socketId, mapName) {
		if (mapName === "online") {
			//when user is joining first time
			if (!userSocketIdMap.has(userId)) {
				userSocketIdMap.set(userId, new Set([socketId]));
			} else {
				//user had already joined from one client and now joining using another client;
				userSocketIdMap.get(userId).add(socketId);
			}
		} else {
			//when user is joining first time
			if (!usersInCall.has(userId)) {
				usersInCall.set(userId, new Set([socketId]));
			} else {
				//user had already joined from one client and now joining using another client;
				usersInCall.get(userId).add(socketId);
			}
		}
	}

	function removeClientFromMap(userId, socketID, mapName) {
		if (mapName === "online") {
			if (userSocketIdMap.has(userId)) {
				const userSocketIdSet = userSocketIdMap.get(userId);
				userSocketIdSet.delete(socketID);
				//if there are no clients for a user, remove that user from online list(map);
				if (userSocketIdSet.size == 0) {
					userSocketIdMap.delete(userId);
				}
			}
		} else {
			if (usersInCall.has(userId)) {
				const userSocketIdSet = usersInCall.get(userId);
				userSocketIdSet.delete(socketID);
				//if there are no clients for a user, remove that user from online list(map);
				if (userSocketIdSet.size == 0) {
					usersInCall.delete(userId);
				}
			}
		}
	}

	return server;
};
