// server.js — kirish nuqtasi. Express /public papkani beradi,
// WebSocket ustida xabarlarni rooms.js'ga yo'naltiradi.

require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const store = require("./store");
const rooms = require("./rooms");

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

app.get("/api/leaderboard", (req, res) => {
  res.json(store.leaderboard(20));
});

app.get("/api/player/:id", (req, res) => {
  const p = store.getPlayer(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ ...p, rank: store.getRank(req.params.id), total: store.totalPlayers() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function send(ws, type, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...payload }));
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "identify": {
        // msg.id yo'q bo'lsa (birinchi marta) — mehmon ID yaratamiz.
        const id = msg.id || "guest_" + crypto.randomBytes(8).toString("hex");
        const name = (msg.name || "O'yinchi").slice(0, 24);
        ws.identity = { id, name, isGuestUnrated: !!msg.isGuest };
        const player = store.getOrCreatePlayer(id, name);
        send(ws, "identified", { id, name: player.name, rating: player.rating, wins: player.wins, losses: player.losses });
        break;
      }
      case "rename": {
        if (!ws.identity) return;
        const newName = (msg.name || "").trim().slice(0, 24);
        if (!newName) return;
        ws.identity.name = newName;
        const player = store.getOrCreatePlayer(ws.identity.id, newName);
        send(ws, "identified", { id: player.id, name: player.name, rating: player.rating, wins: player.wins, losses: player.losses });
        break;
      }
      case "create_room": {
        if (!ws.identity) return;
        rooms.createRoom(ws.identity, ws, false);
        break;
      }
      case "join_room": {
        if (!ws.identity) return;
        const code = (msg.code || "").toUpperCase().trim();
        rooms.joinRoom(code, ws.identity, ws);
        break;
      }
      case "quick_match": {
        if (!ws.identity) return;
        rooms.quickMatch(ws.identity, ws);
        break;
      }
      case "move": {
        rooms.handleMove(ws, msg.r, msg.c);
        break;
      }
      case "wall": {
        rooms.handleWall(ws, msg.orientation, msg.wr, msg.wc);
        break;
      }
      case "rematch": {
        rooms.handleRematch(ws);
        break;
      }
      case "leave_room": {
        rooms.handleDisconnect(ws);
        ws.roomCode = null;
        ws.color = null;
        break;
      }
      default:
        break;
    }
  });

  ws.on("close", () => rooms.handleDisconnect(ws));
});

// o'lik ulanishlarni tozalash
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const { startBot } = require("./bot");
startBot();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Grid Battle server " + PORT + "-portda ishga tushdi"));
