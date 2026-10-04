// store.js — o'yinchilar reytingi (ELO) va tarixini saqlaydi.
// MVP uchun oddiy JSON fayl ishlatiladi. Production'da buni
// Postgres/SQLite'ga almashtirish tavsiya etiladi (Render'ning bepul
// diski deploy qayta ishga tushganda tozalanishi mumkin).

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data.json");
const K = 32; // ELO koeffitsienti

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { players: {} };
  }
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getOrCreatePlayer(id, name) {
  const db = load();
  if (!db.players[id]) {
    db.players[id] = {
      id,
      name: name || "O'yinchi",
      rating: 0,
      wins: 0,
      losses: 0,
      games: 0,
      history: [], // {result:'win'|'loss', delta, opponent, ts}
    };
    save(db);
  } else if (name && db.players[id].name !== name) {
    db.players[id].name = name;
    save(db);
  }
  return db.players[id];
}

function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function recordResult(winnerId, winnerName, loserId, loserName) {
  const db = load();
  const w = getOrCreatePlayer(winnerId, winnerName);
  const l = getOrCreatePlayer(loserId, loserName);

  const expW = expectedScore(w.rating, l.rating);
  const expL = 1 - expW;
  const deltaW = Math.round(K * (1 - expW));
  const deltaL = Math.round(K * (0 - expL));

  w.rating += deltaW;
  l.rating += deltaL;
  w.wins++; w.games++;
  l.losses++; l.games++;
  w.history.unshift({ result: "win", delta: deltaW, opponent: l.name, ts: Date.now() });
  l.history.unshift({ result: "loss", delta: deltaL, opponent: w.name, ts: Date.now() });
  w.history = w.history.slice(0, 20);
  l.history = l.history.slice(0, 20);

  db.players[winnerId] = w;
  db.players[loserId] = l;
  save(db);
  return { winnerDelta: deltaW, loserDelta: deltaL, winnerRating: w.rating, loserRating: l.rating };
}

function leaderboard(limit = 20) {
  const db = load();
  return Object.values(db.players)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map(({ id, name, rating, wins, losses, games }) => ({ id, name, rating, wins, losses, games }));
}

module.exports = { getOrCreatePlayer, recordResult, leaderboard };
