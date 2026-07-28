# -*- coding: utf-8 -*-
"""
7x7 "Devor" o'yini — Quoridor uslubidagi Telegram bot.

Qoidalar:
- Taxta 7x7 (49 katak).
- Har bir o'yinchida 10 tadan devor bor.
- Devor 2 katakni qamrab oladigan tosiq (gorizontal yoki vertikal).
- Sakrab o'tish YO'Q — agar raqib toʻgʻridan-toʻgʻri qoʻshni katakda tursa,
  u katakka yurish mumkin emas (aylanib o'tish kerak).
- G'olib — qarshi tomonning oxirgi qatoriga birinchi yetib borgan o'yinchi.
- Devor qo'yilganda ikkala o'yinchi uchun ham yo'l butunlay to'silib
  qolmasligi tekshiriladi (BFS orqali).

Ishga tushirish:
    pip install -r requirements.txt
    export TELEGRAM_BOT_TOKEN="sizning_tokeningiz"
    python bot.py
"""

import os
import logging
from collections import deque

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

SIZE = 7
WALLS_PER_PLAYER = 10

# chat_id -> game dict
GAMES = {}


def new_game(chat_id, player1_id, player1_name):
    GAMES[chat_id] = {
        "players": [player1_id],
        "names": {player1_id: player1_name},
        "positions": {},  # set once player2 joins
        "walls_left": {},
        "walls": {},  # (r, c) -> 'H' or 'V'
        "turn": None,
        "started": False,
        "winner": None,
    }


def start_positions():
    # Player1 (index 0) starts at top row, goal = bottom row (SIZE-1)
    # Player2 (index 1) starts at bottom row, goal = top row (0)
    mid = SIZE // 2
    return {0: (0, mid), 1: (SIZE - 1, mid)}


def goal_row(player_index):
    return SIZE - 1 if player_index == 0 else 0


def in_bounds(r, c):
    return 0 <= r < SIZE and 0 <= c < SIZE


def wall_blocks(walls, r1, c1, r2, c2):
    """Check if the edge between adjacent cells (r1,c1)-(r2,c2) is blocked."""
    if r1 == r2:  # horizontal neighbors -> vertical wall blocks
        c = min(c1, c2)
        r = r1
        if walls.get((r, c)) == "V":
            return True
        if walls.get((r - 1, c)) == "V":
            return True
        return False
    else:  # vertical neighbors -> horizontal wall blocks
        r = min(r1, r2)
        c = c1
        if walls.get((r, c)) == "H":
            return True
        if walls.get((r, c - 1)) == "H":
            return True
        return False


def get_move_target(pos, direction, walls, other_pos):
    r, c = pos
    if direction == "up":
        nr, nc = r - 1, c
    elif direction == "down":
        nr, nc = r + 1, c
    elif direction == "left":
        nr, nc = r, c - 1
    elif direction == "right":
        nr, nc = r, c + 1
    else:
        return None

    if not in_bounds(nr, nc):
        return None
    if wall_blocks(walls, r, c, nr, nc):
        return None
    if (nr, nc) == other_pos:
        return None  # no jumping, path is simply blocked
    return (nr, nc)


def path_exists(start, goal_r, walls, blocked_cell):
    """BFS: can a pawn at `start` reach any cell in row `goal_r`,
    treating `blocked_cell` (the opponent) as an obstacle."""
    visited = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        if r == goal_r:
            return True
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if not in_bounds(nr, nc):
                continue
            if (nr, nc) in visited:
                continue
            if (nr, nc) == blocked_cell:
                continue
            if wall_blocks(walls, r, c, nr, nc):
                continue
            visited.add((nr, nc))
            q.append((nr, nc))
    return False


def wall_intersection_free(walls, r, c):
    return (r, c) not in walls


def render_board(game):
    positions = game["positions"]
    walls = game["walls"]
    pos_list = {positions[0]: "🔵", positions[1]: "🔴"}

    lines = []
    for r in range(SIZE):
        row_chars = []
        for c in range(SIZE):
            row_chars.append(pos_list.get((r, c), "⬜"))
            if c < SIZE - 1:
                blocked = walls.get((r, c)) == "V" or walls.get((r - 1, c)) == "V"
                row_chars.append("┃" if blocked else " ")
        lines.append("".join(row_chars))
        if r < SIZE - 1:
            seg = []
            for c in range(SIZE):
                blocked = walls.get((r, c)) == "H" or walls.get((r, c - 1)) == "H"
                seg.append("━━" if blocked else "  ")
                if c < SIZE - 1:
                    seg.append(" ")
            lines.append("".join(seg))
    return "\n".join(lines)


def move_keyboard():
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("⬆️", callback_data="move:up")],
            [
                InlineKeyboardButton("⬅️", callback_data="move:left"),
                InlineKeyboardButton("⬇️", callback_data="move:down"),
                InlineKeyboardButton("➡️", callback_data="move:right"),
            ],
            [InlineKeyboardButton("🧱 Devor qo'yish", callback_data="wall:start")],
        ]
    )


def game_status_text(game):
    p1, p2 = game["players"]
    turn_name = game["names"][game["turn"]]
    txt = render_board(game) + "\n"
    txt += f"🔵 {game['names'][p1]} — devor: {game['walls_left'][p1]}\n"
    txt += f"🔴 {game['names'][p2]} — devor: {game['walls_left'][p2]}\n\n"
    txt += f"Navbat: {turn_name}"
    return txt


async def newgame(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    user = update.effective_user
    if chat_id in GAMES and not GAMES[chat_id].get("winner"):
        await update.message.reply_text(
            "Bu chatda allaqachon o'yin boshlangan. /join orqali qo'shiling yoki tugagach /newgame."
        )
        return
    new_game(chat_id, user.id, user.first_name)
    await update.message.reply_text(
        f"O'yin yaratildi! {user.first_name} birinchi o'yinchi (🔵).\n"
        "Ikkinchi o'yinchi /join buyrug'i bilan qo'shilsin."
    )


async def join(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    user = update.effective_user
    game = GAMES.get(chat_id)
    if not game:
        await update.message.reply_text("Avval /newgame bilan o'yin boshlang.")
        return
    if game["started"]:
        await update.message.reply_text("O'yin allaqachon boshlangan.")
        return
    if user.id in game["players"]:
        await update.message.reply_text("Siz allaqachon o'yindasiz.")
        return
    game["players"].append(user.id)
    game["names"][user.id] = user.first_name
    positions = start_positions()
    game["positions"] = {game["players"][0]: positions[0], game["players"][1]: positions[1]}
    game["walls_left"] = {pid: WALLS_PER_PLAYER for pid in game["players"]}
    game["turn"] = game["players"][0]
    game["started"] = True

    await update.message.reply_text(
        game_status_text(game),
        reply_markup=move_keyboard(),
    )


async def board_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    game = GAMES.get(chat_id)
    if not game or not game["started"]:
        await update.message.reply_text("Hali o'yin boshlanmagan.")
        return
    await update.message.reply_text(
        game_status_text(game),
        reply_markup=move_keyboard(),
    )


async def wall_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/wall H r c  yoki  /wall V r c   (r,c: 1-6 oralig'ida, chap-tepa burchakdan)"""
    chat_id = update.effective_chat.id
    user = update.effective_user
    game = GAMES.get(chat_id)
    if not game or not game["started"] or game.get("winner"):
        await update.message.reply_text("Hali o'yin boshlanmagan yoki tugagan.")
        return
    if game["turn"] != user.id:
        await update.message.reply_text("Bu sizning navbatingiz emas.")
        return

    args = context.args
    if len(args) != 3 or args[0].upper() not in ("H", "V"):
        await update.message.reply_text("Format: /wall H yoki V, qator, ustun. Masalan: /wall H 3 2")
        return

    orientation = args[0].upper()
    try:
        r = int(args[1]) - 1
        c = int(args[2]) - 1
    except ValueError:
        await update.message.reply_text("Qator va ustun raqam bo'lishi kerak (1-6).")
        return

    if not (0 <= r <= SIZE - 2 and 0 <= c <= SIZE - 2):
        await update.message.reply_text(f"Qator va ustun 1 dan {SIZE-1} gacha bo'lishi kerak.")
        return

    if game["walls_left"][user.id] <= 0:
        await update.message.reply_text("Sizda devor qolmadi.")
        return

    if not wall_intersection_free(game["walls"], r, c):
        await update.message.reply_text("Bu joyda allaqachon devor bor.")
        return

    # Tentatively place, check both players still have a path
    game["walls"][(r, c)] = orientation
    p1, p2 = game["players"]
    pos1, pos2 = game["positions"][p1], game["positions"][p2]
    ok1 = path_exists(pos1, goal_row(0), game["walls"], pos2)
    ok2 = path_exists(pos2, goal_row(1), game["walls"], pos1)
    if not (ok1 and ok2):
        del game["walls"][(r, c)]
        await update.message.reply_text("Bu devor raqibning yagona yo'lini butunlay to'sib qo'yadi — taqiqlangan.")
        return

    game["walls_left"][user.id] -= 1
    other = p2 if user.id == p1 else p1
    game["turn"] = other

    await update.message.reply_text(
        game_status_text(game),
        reply_markup=move_keyboard(),
    )


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    chat_id = update.effective_chat.id
    user = query.from_user
    game = GAMES.get(chat_id)

    if not game or not game["started"] or game.get("winner"):
        await query.answer("O'yin faol emas.", show_alert=True)
        return
    if game["turn"] != user.id:
        await query.answer("Bu sizning navbatingiz emas.", show_alert=True)
        return

    data = query.data
    if data == "wall:start":
        await query.answer()
        await query.message.reply_text(
            "Devor qo'yish uchun: /wall H yoki V, qator (1-6), ustun (1-6)\n"
            "Masalan: /wall H 3 2"
        )
        return

    if data.startswith("move:"):
        direction = data.split(":")[1]
        p1, p2 = game["players"]
        me, opp = (p1, p2) if user.id == p1 else (p2, p1)
        my_index = 0 if user.id == p1 else 1
        my_pos = game["positions"][me]
        opp_pos = game["positions"][opp]

        target = get_move_target(my_pos, direction, game["walls"], opp_pos)
        if target is None:
            await query.answer("Bu tomonga yurib bo'lmaydi.", show_alert=True)
            return

        game["positions"][me] = target
        await query.answer()

        if target[0] == goal_row(my_index):
            game["winner"] = me
            await query.message.reply_text(
                render_board(game) + f"\n🏆 {game['names'][me]} g'alaba qozondi!",
            )
            return

        game["turn"] = opp
        await query.message.reply_text(
            game_status_text(game),
            reply_markup=move_keyboard(),
        )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "/newgame — yangi o'yin boshlash\n"
        "/join — o'yinga qo'shilish\n"
        "/board — joriy holatni ko'rsatish\n"
        "/wall H|V qator ustun — devor qo'yish (masalan: /wall H 3 2)\n"
        "/reset — shu chatdagi o'yinni bekor qilib, qaytadan boshlash\n"
        "Yurish uchun tugmalardan foydalaning."
    )


async def reset_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id in GAMES:
        del GAMES[chat_id]
    await update.message.reply_text("O'yin tozalandi. Qaytadan boshlash uchun /newgame yozing.")


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN muhit o'zgaruvchisini o'rnating.")

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("newgame", newgame))
    app.add_handler(CommandHandler("join", join))
    app.add_handler(CommandHandler("board", board_cmd))
    app.add_handler(CommandHandler("wall", wall_cmd))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("reset", reset_cmd))
    app.add_handler(CallbackQueryHandler(button_handler))

    logger.info("Bot ishga tushdi.")
    app.run_polling()


if __name__ == "__main__":
    main()
