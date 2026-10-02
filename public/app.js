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
    const savedId = localStorage.getItem("gb_id");
    const savedName = localStorage.getItem("gb_name");
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
    localStorage.setItem("gb_id", myId);
    localStorage.setItem("gb_name", myName);
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