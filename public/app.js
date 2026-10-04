// app.js — lobbi, ekranlar orasida almashish, taymer ko'rsatish va
// Board/Network modullarini bog'lash. O'yin qoidalari BU YERDA YO'Q —
// ular faqat serverda (server/engine.js).

(function () {
  const $ = (id) => document.getElementById(id);
  const screens = { lobby: $("screen-lobby"), game: $("screen-game") };
  const tg = window.Telegram && window.Telegram.WebApp;

  let myId = null, myName = null, myColor = null, mode = "move";
  let lastState = null, lastLegalMoves = [];
  let tickHandle = null;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
  }
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  // localStorage ba'zi brauzerlarda (masalan ilova ichidagi brauzerlar,
  // maxfiylik rejimi) xatolik berishi mumkin — shu sabab har doim
  // try/catch bilan o'raymiz, aks holda butun tugma ishlamay qoladi.
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* e'tiborsiz */ } }

  // ---------- Identity: Telegram bo'lsa avtomatik, bo'lmasa localStorage ----------
  function initIdentity() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      tg.expand();
      const u = tg.initDataUnsafe.user;
      myId = "tg_" + u.id;
      myName = u.first_name || "O'yinchi";
      Network.send("identify", { id: myId, name: myName });
      return;
    }
    const savedId = safeGet("gb_id");
    const savedName = safeGet("gb_name");
    if (savedId && savedName) {
      myId = savedId; myName = savedName;
      Network.send("identify", { id: myId, name: myName });
      show($("lobby-main")); hide($("name-gate"));
    } else {
      show($("name-gate")); hide($("lobby-main"));
    }
  }

  $("btn-save-name").addEventListener("click", () => {
    const val = $("name-input").value.trim();
    if (!val) return;
    myName = val;
    myId = "guest_" + Math.random().toString(36).slice(2, 10);
    safeSet("gb_id", myId);
    safeSet("gb_name", myName);
    Network.send("identify", { id: myId, name: myName });
    hide($("name-gate")); show($("lobby-main"));
  });

  // ---------- Lobby actions ----------
  $("btn-quick").addEventListener("click", () => Network.send("quick_match"));
  $("btn-create").addEventListener("click", () => Network.send("create_room"));
  $("btn-join-toggle").addEventListener("click", () => $("join-box").classList.toggle("hidden"));
  $("btn-join").addEventListener("click", () => {
    const code = $("code-input").value.trim().toUpperCase();
    if (code.length === 4) Network.send("join_room", { code });
  });
  $("btn-cancel-wait").addEventListener("click", () => {
    Network.send("leave_room");
    hide($("waiting-box")); show($("lobby-main"));
  });
  $("btn-leave").addEventListener("click", () => {
    Network.send("leave_room");
    clearInterval(tickHandle);
    showScreen("lobby");
    show($("lobby-main")); hide($("waiting-box"));
    refreshLeaderboard();
  });

  function refreshLeaderboard() {
    fetch("/api/leaderboard").then((r) => r.json()).then((list) => {
      $("lb-list").innerHTML = list
        .map((p, i) => `<div class="lb-row"><span class="lb-name">${i + 1}. ${escapeHtml(p.name)}</span><span class="lb-rating">${p.rating}</span></div>`)
        .join("") || '<div class="lb-row"><span class="lb-name">Hali o\'yinlar yo\'q</span></div>';
    }).catch(() => {});
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // ---------- Network events ----------
  Network.on("identified", (msg) => {
    $("p-name").textContent = msg.name;
    $("p-rating").textContent = msg.rating;
    $("p-wl").textContent = `${msg.wins}W / ${msg.losses}L`;
    refreshLeaderboard();
  });

  Network.on("queued", () => {
    hide($("lobby-main"));
    $("room-code-display").textContent = "";
    $("waiting-box").querySelector(".status").textContent = "Tezkor o'yin uchun raqib qidirilmoqda…";
    show($("waiting-box"));
  });

  Network.on("room_created", (msg) => {
    myColor = msg.color;
    hide($("lobby-main"));
    $("waiting-box").querySelector(".status").textContent = "Raqib kutilmoqda…";
    $("room-code-display").textContent = msg.code;
    show($("waiting-box"));
  });

  Network.on("room_joined", (msg) => {
    myColor = msg.color;
  });

  Network.on("error", (msg) => {
    const statusEl = document.getElementById("status");
    if (statusEl) { statusEl.textContent = "⚠ " + msg.reason; statusEl.classList.add("err"); }
  });

  Network.on("opponent_left", () => {
    const statusEl = document.getElementById("status");
    if (statusEl) { statusEl.textContent = "Raqib chiqib ketdi"; statusEl.classList.add("err"); }
  });

  Network.on("state", (msg) => {
    lastState = msg.state;
    lastLegalMoves = msg.legalMoves;
    $("name-red").textContent = msg.players.red ? msg.players.red.name : "1-O'YINCHI";
    $("name-blue").textContent = msg.players.blue ? msg.players.blue.name : "2-O'YINCHI";

    if (lastState.status === "waiting") {
      // Raqib hali qo'shilmadi — xona kodi ekranida qolaveramiz, o'yin ekraniga o'tmaymiz
      return;
    }

    hide($("waiting-box"));
    showScreen("game");
    draw();
    if (lastState.status === "playing") startTicker();
    if (lastState.status === "finished") {
      clearInterval(tickHandle);
      showWin(lastState.winner);
    } else {
      overlay.classList.remove("show");
    }
  });

  Network.on("game_over", (msg) => {
    $("p-rating").textContent = msg.youWin ? msg.winnerRating : msg.loserRating;
  });

  // ---------- Mode buttons ----------
  $("btn-move").addEventListener("click", () => { mode = "move"; draw(); });
  $("btn-h").addEventListener("click", () => { mode = "h"; draw(); });
  $("btn-v").addEventListener("click", () => { mode = "v"; draw(); });

  function draw() {
    if (!lastState) return;
    BoardUI.render({
      state: lastState,
      legalMoves: lastLegalMoves,
      myColor,
      mode,
      onMove: (r, c) => { Network.send("move", { r, c }); mode = "move"; },
      onWall: (orientation, wr, wc) => Network.send("wall", { orientation, wr, wc }),
    });
    $("walls-red").textContent = lastState.wallsLeft.red;
    $("walls-blue").textContent = lastState.wallsLeft.blue;
    $("card-red").classList.toggle("active", lastState.current === "red" && lastState.status === "playing");
    $("card-blue").classList.toggle("active", lastState.current === "blue" && lastState.status === "playing");
    $("btn-move").classList.toggle("selected", mode === "move");
    $("btn-h").classList.toggle("selected", mode === "h");
    $("btn-v").classList.toggle("selected", mode === "v");
    const isMyTurn = lastState.status === "playing" && lastState.current === myColor;
    $("btn-h").disabled = !isMyTurn || lastState.wallsLeft[myColor] <= 0;
    $("btn-v").disabled = !isMyTurn || lastState.wallsLeft[myColor] <= 0;
    $("status").classList.remove("err");
    $("status").textContent = lastState.status === "playing"
      ? (isMyTurn ? "Sizning navbatingiz" : "Raqib navbati…")
      : "";
  }

  function startTicker() {
    clearInterval(tickHandle);
    tickHandle = setInterval(() => {
      if (!lastState || !lastState.turnEndsAt) return;
      const remain = Math.max(0, lastState.turnEndsAt - Date.now());
      const pct = Math.max(0, (remain / 30000) * 100);
      const bar = $("timerbar");
      bar.style.width = pct + "%";
      bar.classList.toggle("low", remain <= 8000);
    }, 250);
  }

  const overlay = $("overlay");
  function showWin(winner) {
    $("win-trophy").textContent = winner === "red" ? "🔴🏆" : "🔵🏆";
    const iWon = winner === myColor;
    $("win-title").textContent = iWon ? "SIZ YUTDINGIZ!" : "SIZ YUTQAZDINGIZ";
    $("win-sub").textContent = (winner === "red" ? $("name-red").textContent : $("name-blue").textContent) + " g'alaba qozondi";
    overlay.classList.add("show");
  }
  $("btn-revansh").addEventListener("click", () => {
    Network.send("rematch");
    $("win-sub").textContent = "Raqibning tasdig'i kutilmoqda…";
  });
  $("btn-menu").addEventListener("click", () => {
    Network.send("leave_room");
    overlay.classList.remove("show");
    clearInterval(tickHandle);
    showScreen("lobby");
    show($("lobby-main")); hide($("waiting-box"));
    refreshLeaderboard();
  });

$("btn-rules").addEventListener("click", () => $("rules-overlay").classList.add("show"));
  $("btn-rules-game").addEventListener("click", () => $("rules-overlay").classList.add("show"));
  $("btn-close-rules").addEventListener("click", () => $("rules-overlay").classList.remove("show"));

// ---------- Profil ----------
  function escapeHtml2(s) { return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  function openProfile() {
    $("profile-overlay").classList.add("show");
    $("profile-name-input").value = myName || "";
    fetch("/api/player/" + myId).then((r) => r.json()).then((p) => {
      const winrate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
      $("stat-games").textContent = p.games;
      $("stat-winrate").textContent = winrate + "%";
      $("stat-rank").textContent = p.rank ? ("#" + p.rank) : "—";
      $("profile-history").innerHTML = (p.history || []).map((h) => {
        const cls = h.result === "win" ? "win" : "loss";
        const sign = h.delta > 0 ? "+" : "";
        const date = new Date(h.ts).toLocaleDateString();
        return `<div class="history-row ${cls}">
          <span>${h.result === "win" ? "✅" : "❌"} <span class="h-opp">${escapeHtml2(h.opponent)}</span></span>
          <span class="h-delta">${sign}${h.delta}</span>
          <span class="h-date">${date}</span>
        </div>`;
      }).join("") || '<div class="history-row"><span>Hali o\'yinlar yo\'q</span></div>';
    }).catch(() => {});
  }

  $("btn-profile").addEventListener("click", openProfile);
  $("btn-close-profile").addEventListener("click", () => $("profile-overlay").classList.remove("show"));
  $("btn-save-profile-name").addEventListener("click", () => {
    const val = $("profile-name-input").value.trim();
    if (!val) return;
    myName = val;
    safeSet("gb_name", myName);
    Network.send("rename", { name: myName });
  });

  $("btn-rules").addEventListener("click", () => $("rules-overlay").classList.add("show"));
  $("btn-rules-game").addEventListener("click", () => $("rules-overlay").classList.add("show"));
  $("btn-close-rules").addEventListener("click", () => $("rules-overlay").classList.remove("show"));

  Network.on("open", initIdentity);
})();
