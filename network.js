// network.js — serverga ulanish. Boshqa fayllar bu modul orqaligina
// tarmoq bilan gaplashadi (app.js window.Network.send(...) chaqiradi).

window.Network = (function () {
  let ws = null;
  let handlers = {};
  let reconnectDelay = 1000;

  function connect() {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(proto + location.host);

    ws.onopen = () => {
      reconnectDelay = 1000;
      fire("open", {});
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      fire(msg.type, msg);
    };
    ws.onclose = () => {
      fire("close", {});
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 8000);
    };
    ws.onerror = () => ws.close();
  }

  function fire(type, payload) {
    (handlers[type] || []).forEach((fn) => fn(payload));
  }

  function on(type, fn) {
    handlers[type] = handlers[type] || [];
    handlers[type].push(fn);
  }

  function send(type, payload) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type, ...(payload || {}) }));
  }

  connect();
  return { on, send };
})();
