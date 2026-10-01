# Grid Battle — Online

7×7 katakli maydonda 2 o'yinchi kurashadigan strategik o'yin.
Bitta Node.js backend — ham oddiy sayt, ham Telegram Web App sifatida ishlaydi.

## Fayl tuzilishi (nima qayerda)

```
grid-battle/
  server/
    engine.js     ← O'YIN QOIDALARI (yurish, devor, g'alaba). Faqat shu faylni
                     o'zgartirsangiz qoidalar butun loyihada yangilanadi.
    rooms.js      ← Xonalar, tezkor moslashtirish (matchmaking), taymer
    store.js      ← ELO reyting va o'yin tarixi (data.json fayliga saqlanadi)
    server.js     ← Kirish nuqtasi: Express + WebSocket
    bot.js        ← Ixtiyoriy Telegram bot (faqat "▶️ O'ynash" tugmasi)
  public/
    index.html    ← Sahifa skeleti (lobby + o'yin ekrani)
    style.css     ← Dizayn
    network.js    ← WebSocket ulanish (qayta ulanish bilan)
    board.js      ← Doskani chizish (faqat serverdan kelgan holatni ko'rsatadi)
    app.js        ← Lobbi mantig'i, ekranlar almashinuvi, taymer ko'rsatish
```

**Muhim tamoyil:** o'yin qoidalarini (masalan, devor sonini, taymer vaqtini,
doska o'lchamini) faqat `server/engine.js`da o'zgartirasiz — chunki server
yagona haqiqat manbai (client "aldab" harakat qila olmaydi). `public/`
papkasidagi fayllar faqat ko'rsatish va tugmalar uchun.

## Mahalliy ishga tushirish

```bash
cd server
npm install
cp .env.example .env
npm start
```

Brauzerda oching: `http://localhost:3000`

## GitHub'ga joylash

```bash
cd grid-battle
git init
git add .
git commit -m "Grid Battle v1"
git branch -M main
git remote add origin https://github.com/<username>/grid-battle.git
git push -u origin main
```

## Bepul serverga deploy qilish (Render.com misolida)

1. https://render.com — GitHub akkaunt bilan kiring.
2. **New → Web Service** → repo'ni tanlang.
3. Sozlamalar:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Deploy tugagach sizga `https://grid-battle-xxxx.onrender.com` manzili beriladi — bu saytingiz tayyor. (Render bepul tarifda 15 daqiqa harakatsizlikdan keyin "uxlab qoladi" — birinchi so'rov 20-30s sekinroq ochiladi, bu normal.)

> Railway.app yoki Fly.io ham xuddi shunday ishlaydi (Root Directory: `server`, Start: `npm start`).

## Telegram Web App qilib ulash

1. Telegram'da **@BotFather** ga yozing → `/newbot` → nom bering, token oling.
2. `server/.env` fayliga yozing:
   ```
   TELEGRAM_BOT_TOKEN=BotFather bergan token
   WEBAPP_URL=https://grid-battle-xxxx.onrender.com
   ```
3. Serverga ham shu ikki qiymatni **Environment Variables** bo'limida qo'shing (Render → Settings → Environment).
4. Botni alohida ishga tushiring: `npm run bot` (buni ham Render'da ikkinchi **Background Worker** sifatida joylashtirish mumkin).
5. Botga `/start` yozing → "▶️ O'ynash" tugmasi chiqadi → bosilganda o'yin Telegram ichida ochiladi, ism/ID avtomatik Telegramdan olinadi.

Ixtiyoriy: BotFather'da `/setmenubutton` orqali botning doimiy "Play" tugmasini ham sozlashingiz mumkin (xuddi shu `WEBAPP_URL` bilan).

## Hozircha yo'q, keyingi bosqichda qo'shsa bo'ladigan narsalar

- Tomoshabin (spectator) rejimi — server allaqachon `spectators` massivini tayyorlab qo'ygan, faqat lobbidan "kuzatish" tugmasi kerak
- Chat / emoji
- Uzilib qolgan o'yinni qayta ulash (hozir uzilsa, raqibga xabar boradi, lekin xona darhol yopilmaydi — buni to'liqroq qilish mumkin)
- ELO'ni JSON fayl o'rniga haqiqiy DB (Postgres) ga ko'chirish — Render qayta deploy qilinganda `data.json` tiklanib ketishi mumkin
