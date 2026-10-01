// engine.js — Grid Battle qoidalari (server-side, yagona haqiqat manbai).
// Bu fayl hech qanday tarmoq/DOM bilan ishlamaydi — faqat sof o'yin mantig'i.
// Kelajakda qoidani o'zgartirsangiz FAQAT shu faylni tahrirlaysiz.

const N = 7;               // doska o'lchami
const TURN_TIME_MS = 30000; // har bir yurish uchun vaqt

function createGameState(roomId) {
  return {
    roomId,
    pos: { red: { r: 6, c: 3 }, blue: { r: 0, c: 3 } },
    target: { red: 0, blue: 6 }, // red -> 0-qatorga, blue -> 6-qatorga
    walls: [],                   // {orientation:'h'|'v', r, c, owner}
    wallsLeft: { red: 10, blue: 10 },
    current: "red",
    status: "waiting",           // waiting | playing | finished
    winner: null,
    turnEndsAt: null,
    seq: 0,
    rematch: { red: false, blue: false },
  };
}

function edgeBlocked(r1, c1, r2, c2, walls) {
  if (r1 === r2) {
    const cA = Math.min(c1, c2);
    const row = r1;
    return walls.some(
      (w) => w.orientation === "v" && w.r === row && (w.c === cA || w.c === cA - 1)
    );
  } else {
    const rA = Math.min(r1, r2);
    const col = c1;
    return walls.some(
      (w) => w.orientation === "h" && w.c === col && (w.r === rA || w.r === rA - 1)
    );
  }
}

function neighbors(r, c, walls) {
  const res = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
    if (edgeBlocked(r, c, nr, nc, walls)) continue;
    res.push([nr, nc]);
  }
  return res;
}

function pathExists(player, pos, target, walls) {
  const start = pos[player];
  const goalRow = target[player];
  const seen = new Set([start.r + "," + start.c]);
  const q = [[start.r, start.c]];
  while (q.length) {
    const [r, c] = q.shift();
    if (r === goalRow) return true;
    for (const [nr, nc] of neighbors(r, c, walls)) {
      const k = nr + "," + nc;
      if (!seen.has(k)) {
        seen.add(k);
        q.push([nr, nc]);
      }
    }
  }
  return false;
}

function legalMoves(state, player) {
  if (state.status !== "playing" || state.current !== player) return [];
  const pos = state.pos[player];
  const opp = player === "red" ? "blue" : "red";
  const oppPos = state.pos[opp];
  const forwardDelta = player === "red" ? -1 : 1;
  const dirs = [{ dr: forwardDelta, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
  const moves = [];
  for (const d of dirs) {
    const nr = pos.r + d.dr, nc = pos.c + d.dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
    if (nr === oppPos.r && nc === oppPos.c) continue;
    if (edgeBlocked(pos.r, pos.c, nr, nc, state.walls)) continue;
    moves.push({ r: nr, c: nc });
  }
  return moves;
}

function hSlotCells(wr, wc) {
  const row = 2 * wr + 1;
  return [row + "," + 2 * wc, row + "," + (2 * wc + 1), row + "," + (2 * wc + 2)];
}
function vSlotCells(wr, wc) {
  const col = 2 * wc + 1;
  return [2 * wr + "," + col, (2 * wr + 1) + "," + col, (2 * wr + 2) + "," + col];
}
function wallCellSet(walls) {
  const set = new Set();
  walls.forEach((w) => {
    const cells = w.orientation === "h" ? hSlotCells(w.r, w.c) : vSlotCells(w.r, w.c);
    cells.forEach((k) => set.add(k));
  });
  return set;
}

// ---- Public mutating actions. Return {ok:true, state} or {ok:false, reason} ----

function applyMove(state, player, r, c) {
  const moves = legalMoves(state, player);
  if (!moves.some((m) => m.r === r && m.c === c)) {
    return { ok: false, reason: "Bu yurish mumkin emas" };
  }
  state.pos[player] = { r, c };
  state.seq++;
  if (r === state.target[player]) {
    state.status = "finished";
    state.winner = player;
    state.turnEndsAt = null;
  } else {
    state.current = player === "red" ? "blue" : "red";
    state.turnEndsAt = Date.now() + TURN_TIME_MS;
  }
  return { ok: true, state };
}

function applyWall(state, player, orientation, wr, wc) {
  if (state.status !== "playing" || state.current !== player) {
    return { ok: false, reason: "Sizning navbatingiz emas" };
  }
  if (wr < 0 || wr > 5 || wc < 0 || wc > 5) return { ok: false, reason: "Chegaradan tashqari" };
  if (state.wallsLeft[player] <= 0) return { ok: false, reason: "Devorlar tugadi" };

  const cells = orientation === "h" ? hSlotCells(wr, wc) : vSlotCells(wr, wc);
  const occupied = wallCellSet(state.walls);
  if (cells.some((k) => occupied.has(k))) return { ok: false, reason: "Bu joy band" };

  const trialWalls = state.walls.concat([{ orientation, r: wr, c: wc, owner: player }]);
  if (
    !pathExists("red", state.pos, state.target, trialWalls) ||
    !pathExists("blue", state.pos, state.target, trialWalls)
  ) {
    return { ok: false, reason: "Raqib yo'lini butunlay yopib bo'lmaydi" };
  }

  state.walls = trialWalls;
  state.wallsLeft[player]--;
  state.current = player === "red" ? "blue" : "red";
  state.turnEndsAt = Date.now() + TURN_TIME_MS;
  state.seq++;
  return { ok: true, state };
}

function passTurnOnTimeout(state) {
  if (state.status !== "playing") return state;
  state.current = state.current === "red" ? "blue" : "red";
  state.turnEndsAt = Date.now() + TURN_TIME_MS;
  state.seq++;
  return state;
}

function startGame(state) {
  state.status = "playing";
  state.turnEndsAt = Date.now() + TURN_TIME_MS;
  state.seq++;
  return state;
}

function resetForRematch(state, swapColors) {
  const fresh = createGameState(state.roomId);
  fresh.status = "playing";
  fresh.turnEndsAt = Date.now() + TURN_TIME_MS;
  fresh.seq = state.seq + 1;
  return fresh;
}

module.exports = {
  N,
  TURN_TIME_MS,
  createGameState,
  legalMoves,
  applyMove,
  applyWall,
  passTurnOnTimeout,
  startGame,
  resetForRematch,
  wallCellSet,
  hSlotCells,
  vSlotCells,
};
