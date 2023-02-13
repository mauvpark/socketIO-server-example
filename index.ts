const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
	cors: {
		origin: "URL",
		credentials: true,
	},
});

// 미들웨어
io.use((socket, next) => {
	const username = socket.handshake.auth.username;
	if (!username) {
		return next(new Error("not authorized"));
	}
	socket.username = username;
	next();
});

io.on("connection", (socket) => {
	// 모든 sockets 등록
	const users = <{ userID: string; username: string }[]>[];
	for (let [id, socket] of io.sockets) {
		users.push({
			userID: id,
			username: socket.username,
		});
	}
	socket.emit("users", users);

	// 현재 연결된 socket
	socket.broadcast.emit("userConnected", {
		userID: socket.id,
		username: socket.username,
	});

	// 서버 시작 메시지
	socket.emit("chatMessage", {
		type: "notice",
		value: "서버에 접속했습니다.",
	});
	// 유저 카운팅
	socket.emit("usersCount", io.engine.clientsCount);

	socket.on("banAllUsers", (callback) => {
		// 서버 종료 메시지
		io.emit("chatMessage", {
			type: "notice",
			value: "서버가 종료되었습니다.",
		});
		// 서버 종료
		callback({
			disconnect: io.disconnectSockets(),
		});
	});
	socket.on("chatMessage", (msg) => {
		// 이미지 처리
		if (msg.type === "image") {
			console.log("img", msg.value);
			const uuid = uuidv4();
			fs.writeFileSync(
				path.resolve(__dirname, `tmp/images/${uuid}.jpg`),
				msg.value,
				(err) => {
					console.error(err);
				}
			);
			const p = path.resolve(__dirname, `tmp/images/${uuid}.jpg`);

			fs.readFile(p, (err, data) => {
				const base64 = data.toString("base64");
				io.emit("chatMessage", { type: msg.type, value: base64 });
			});

			return;
		}
		io.emit("chatMessage", msg);
		console.log("message: " + msg);
	});

	socket.on("disconnect", () => {
		console.log("user disconnected");
	});
});

server.listen(8000, () => {
	console.log("listening on *:8000");
});
