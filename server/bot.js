// bot.js — ixtiyoriy Telegram bot. Faqat "/start" bosilganda
// o'yin ochiluvchi tugma yuboradi. Asosiy o'yin mantig'i server.js'da,
// bu fayl shunchaki Telegram tomonidan kirish eshigi.
//
// server.js shu faylni avtomatik ishga tushiradi, agar TELEGRAM_BOT_TOKEN
// va WEBAPP_URL muhit o'zgaruvchilari (Render → Environment) to'ldirilgan bo'lsa.

function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webAppUrl = process.env.WEB_APP_URL;

  if (!token || !webAppUrl) {
    console.log("Telegram bot o'tkazib yuborildi: TELEGRAM_BOT_TOKEN / WEBAPP_URL o'rnatilmagan");
    return;
  }

  const TelegramBot = require("node-telegram-bot-api");
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎮 Grid Battle — 7×7 maydonda strategik jang!", {
      reply_markup: {
        inline_keyboard: [[{ text: "▶️ O'ynash", web_app: { url: webAppUrl } }]],
      },
    });
  });

  bot.on("polling_error", (err) => console.error("Telegram polling xatosi:", err.message));

  console.log("Grid Battle Telegram bot ishga tushdi");
}

module.exports = { startBot };
