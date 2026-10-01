// rooms.js — xonalar va tezkor moslashtirish (matchmaking) navbati.
// Har bir xona: {code, state, sockets:{red,blue}, spectators:[], timer}

const engine = require("./engine");
const store = require("./store");

const rooms = new Map();      // code -> room
let quickQueue = null;        // {id, name, ws} kutayotgan bitta o'yinchi

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function send(ws, type, payload) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type, ...payload }));
}

function publicState(room) {
  // client uchun: to'liq holat + navbatdagi o'yinchi uchun mumkin bo'lgan yurishlar
  return {
    code: room.code,
    state: room.state,
    players: {
      red: room.players.red ? { name: room.players.red.name } : null,
      blue: room.players.blue ? { name: room.players.blue.name } : null,
    },
    legalMoves: engine.legalMoves(room.state, room.state.current),
    spectators: room.spectators.length,
  };
}

function broadcast(room) {
  const payload = publicState(room);
  send(room.sockets.red, "state", payload);
  send(room.sockets.blue, "state", payload);
  room.spectators.forEach((s) => send(s, "state", payload));
}

function clearTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}

function armTimer(room) {
  clearTimer(room);
  if (room.state.status !== "playing" || !room.state.turnEndsAt) return;
  const ms = Math.max(0, room.state.turnEndsAt - Date.now());
  room.timer = setTimeout(() => {
    engine.passTurnOnTimeout(room.state);
    broadcast(room);
    armTimer(room);
  }, ms + 50);
}

function finishGame(room) {
  clearTimer(room);
  const winnerColor = room.state.winner;
  const loserColor = winnerColor === "red" ? "blue" : "red";
  const winner = room.players[winnerColor];
  const loser = room.players[loserColor];
  if (winner && loser && !winner.isGuestUnrated && !loser.isGuestUnrated) {
    const res = store.recordResult(winner.id, winner.name, loser.id, loser.name);
    send(room.sockets[winnerColor], "game_over", { youWin: true, ...res });
    send(room.sockets[loserColor], "game_over", { youWin: false, ...res });
  }
}

function createRoom(identity, ws, isQuick) {
  const code = genCode();
  const room = {
    code,
    state: engine.createGameState(code),
    players: { red: identity, blue: null },
    sockets: { red: ws, blue: null },
    spectators: [],
    timer: null,
    isQuick: !!isQuick,
  };
  rooms.set(code, room);
  ws.roomCode = code;
  ws.color = "red";
  send(ws, "room_created", { code, color: "red" });
  broadcast(room);
  return room;
}

function joinRoom(code, identity, ws) {
  const room = rooms.get(code);
  if (!room) return send(ws, "error", { reason: "Xona topilmadi" });
  if (room.players.blue) return send(ws, "error", { reason: "Xona to'la" });
  if (room.players.red && room.players.red.id === identity.id)
    return send(ws, "error", { reason: "O'zingizga qo'shila olmaysiz" });

  room.players.blue = identity;
  room.sockets.blue = ws;
  ws.roomCode = code;
  ws.color = "blue";
  engine.startGame(room.state);
  send(ws, "room_joined", { code, color: "blue" });
  broadcast(room);
  armTimer(room);
  return room;
}

function quickMatch(identity, ws) {
  if (quickQueue && quickQueue.id !== identity.id) {
    const opponent = quickQueue;
    quickQueue = null;
    const room = createRoom(opponent.identity, opponent.ws, true);
    joinRoom(room.code, identity, ws);
  } else {
    quickQueue = { id: identity.id, identity, ws };
    send(ws, "queued", {});
  }
}

function leaveQueueIfWaiting(ws) {
  if (quickQueue && quickQueue.ws === ws) quickQueue = null;
}

function handleMove(ws, r, c) {
  const room = rooms.get(ws.roomCode);
  if (!room || !ws.color) return;
  const res = engine.applyMove(room.state, ws.color, r, c);
  if (!res.ok) return send(ws, "error", { reason: res.reason });
  if (room.state.status === "finished") {
    broadcast(room);
    finishGame(room);
  } else {
    broadcast(room);
    armTimer(room);
  }
}

function handleWall(ws, orientation, wr, wc) {
  const room = rooms.get(ws.roomCode);
  if (!room || !ws.color) return;
  const res = engine.applyWall(room.state, ws.color, orientation, wr, wc);
  if (!res.ok) return send(ws, "error", { reason: res.reason });
  broadcast(room);
  armTimer(room);
}

function handleRematch(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room || !ws.color) return;
  room.state.rematch[ws.color] = true;
  if (room.state.rematch.red && room.state.rematch.blue) {
    engine.resetForRematch(room.state);
    broadcast(room);
    armTimer(room);
  } else {
    broadcast(room);
  }
}

function handleDisconnect(ws) {
  leaveQueueIfWaiting(ws);
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  if (ws.color && room.sockets[ws.color] === ws) {
    room.sockets[ws.color] = null;
    const other = ws.color === "red" ? room.sockets.blue : room.sockets.red;
    send(other, "opponent_left", {});
  } else {
    room.spectators = room.spectators.filter((s) => s !== ws);
  }
  // Room bo'sh qolsa, biroz vaqtdan keyin tozalash mumkin (MVP: darhol tozalamaymiz,
  // chunki reconnect logikasi keyingi bosqichda qo'shiladi).
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  quickMatch,
  handleMove,
  handleWall,
  handleRematch,
  handleDisconnect,
  broadcast,
  publicState,
};
