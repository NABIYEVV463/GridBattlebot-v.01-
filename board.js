// board.js — doskani chizadi. O'zi hech qanday qoida bilmaydi:
// faqat serverdan kelgan `state` va `legalMoves`ni ko'rsatadi,
// bosilganda tashqaridan berilgan callback'larni chaqiradi.

window.BoardUI = (function () {
  const boardEl = document.getElementById("board");
  const N = 7;

  function cellStyle(r, c) {
    return `grid-row:${2 * r + 1};grid-column:${2 * c + 1};`;
  }
  function hSlotCells(wr, wc) {
    const row = 2 * wr + 1;
    return [row + "," + 2 * wc, row + "," + (2 * wc + 1), row + "," + (2 * wc + 2)];
  }
  function vSlotCells(wr, wc) {
    const col = 2 * wc + 1;
    return [2 * wr + "," + col, (2 * wr + 1) + "," + col, (2 * wr + 2) + "," + col];
  }
  function occupiedCells(walls) {
    const set = new Set();
    walls.forEach((w) => {
      (w.orientation === "h" ? hSlotCells(w.r, w.c) : vSlotCells(w.r, w.c)).forEach((k) => set.add(k));
    });
    return set;
  }

  // render({state, legalMoves, myColor, mode, onMove, onWall})
  function render({ state, legalMoves, myColor, mode, onMove, onWall }) {
    boardEl.innerHTML = "";
    const isMyTurn = state.status === "playing" && state.current === myColor;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const div = document.createElement("div");
        div.className = "cell" + ((r + c) % 2 === 1 ? " dark" : "");
        if (r === 0) div.classList.add("goal-top");
        if (r === N - 1) div.classList.add("goal-bottom");
        div.style.cssText = cellStyle(r, c);
        boardEl.appendChild(div);
      }
    }

    state.walls.forEach((w) => {
      const div = document.createElement("div");
      div.className = "wallpiece " + (w.owner === "red" ? "p-red" : "p-blue");
      if (w.orientation === "h") {
        div.style.cssText = `grid-row:${2 * w.r + 2};grid-column:${2 * w.c + 1} / span 3;height:var(--gap);align-self:center;`;
      } else {
        div.style.cssText = `grid-column:${2 * w.c + 2};grid-row:${2 * w.r + 1} / span 3;width:var(--gap);justify-self:center;`;
      }
      boardEl.appendChild(div);
    });

    if (isMyTurn && mode === "move") {
      (legalMoves || []).forEach((m) => {
        const div = document.createElement("div");
        div.className = "movehint";
        div.style.cssText = cellStyle(m.r, m.c);
        div.addEventListener("click", () => onMove(m.r, m.c));
        boardEl.appendChild(div);
      });
    }

    if (isMyTurn && (mode === "h" || mode === "v")) {
      const occupied = occupiedCells(state.walls);
      for (let wr = 0; wr <= 5; wr++) {
        for (let wc = 0; wc <= 5; wc++) {
          const cells = mode === "h" ? hSlotCells(wr, wc) : vSlotCells(wr, wc);
          const free = cells.every((k) => !occupied.has(k));
          const div = document.createElement("div");
          div.className = "wallslot" + (free ? "" : " blocked");
          if (mode === "h") {
            div.style.cssText = `grid-row:${2 * wr + 2};grid-column:${2 * wc + 1} / span 3;`;
          } else {
            div.style.cssText = `grid-column:${2 * wc + 2};grid-row:${2 * wr + 1} / span 3;`;
          }
          if (free) div.addEventListener("click", () => onWall(mode, wr, wc));
          boardEl.appendChild(div);
        }
      }
    }

    ["red", "blue"].forEach((p) => {
      const pos = state.pos[p];
      const div = document.createElement("div");
      div.className = "ball " + p;
      div.style.cssText = `grid-row:${2 * pos.r + 1};grid-column:${2 * pos.c + 1};width:calc(var(--cell) * .74);height:calc(var(--cell) * .74);align-self:center;justify-self:center;`;
      boardEl.appendChild(div);
    });
  }

  return { render };
})();
