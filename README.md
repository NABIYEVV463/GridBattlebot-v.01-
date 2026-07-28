# Devor o'yini — Telegram bot

7x7 taxtali, Quoridor uslubidagi 2 kishilik devor o'yini.

## O'rnatish

```bash
pip install -r requirements.txt
```

## Ishga tushirish

1. Telegram'da [@BotFather](https://t.me/BotFather) orqali yangi bot yarating va tokenni oling.
2. Muhit o'zgaruvchisini o'rnating:

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
```

3. Botni ishga tushiring:

```bash
python bot.py
```

## Qanday o'ynaladi

1. Bir xil Telegram guruh chatida (yoki bot bilan shaxsiy chatda ikkalangiz ham yozsangiz) birinchi o'yinchi `/newgame` yozadi.
2. Ikkinchi o'yinchi `/join` yozib qo'shiladi — o'yin shu zahoti boshlanadi.
3. Har bir navbatda tugmalar orqali yurish (⬆️⬇️⬅️➡️) yoki devor qo'yish mumkin:
   - Devor qo'yish uchun: `/wall H 3 2` yoki `/wall V 5 4` (H = gorizontal, V = vertikal, keyin qator va ustun 1 dan 6 gacha).
4. Kimning piyodasi qarshi tomonning oxirgi qatoriga birinchi yetsa — o'sha g'olib.

## Qoidalar / cheklovlar

- Har bir o'yinchida 10 tadan devor bor.
- Raqib to'g'ridan-to'g'ri qo'shni katakda tursa, ustidan sakrab o'tib bo'lmaydi — aylanib o'tish kerak.
- Devor qo'yilganda, agar bu devor ikkala o'yinchidan birining yo'lini butunlay to'sib qo'ysa, tizim bu devorni taqiqlaydi.
- Hozircha bitta chatda faqat bitta faol o'yin bo'ladi (xotira ichida saqlanadi — bot qayta ishga tushsa, o'yinlar tozalanadi).

## Kengaytirish g'oyalari

- Ma'lumotlarni fayl/DB'ga saqlash (bot qayta yoqilganda o'yin yo'qolmasin uchun).
- Devor qo'yishni ham inline tugmalar orqali (matn buyrug'isiz) qilish.
- Bir nechta chatda bir vaqtda ko'p o'yinlarni qo'llab-quvvatlash (allaqachon chat_id bo'yicha ajratilgan, faqat UI yaxshilash kerak).
- Reyting/statistika tizimi qo'shish.
