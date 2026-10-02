// bot.js — ixtiyoriy Telegram bot. Faqat "/start" bosilganda
// o'yin ochiluvchi tugma yuboradi. Asosiy o'yin mantig'i server.js'da,
// bu fayl shunchaki Telegram tomonidan kirish eshigi.
//
// Ishga tushirish: TELEGRAM_BOT_TOKEN va WEBAPP_URL ni .env'ga yozing,
// so'ng: npm run bot

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL; // masalan: https://grid-battle.onrender.com

if (!token || !webAppUrl) {
  console.error("TELEGRAM_BOT_TOKEN va WEBAPP_URL .env faylida ko'rsatilishi kerak");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🎮 Grid Battle — 7×7 maydonda strategik jang!", {
    reply_markup: {
      inline_keyboard: [[{ text: "▶️ O'ynash", web_app: { url: webAppUrl } }]],
    },
  });
});

console.log("Grid Battle bot ishga tushdi");
