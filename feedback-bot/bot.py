"""Telegram-бот для сбора отзывов клиентов.

Сценарий (чистые функции «состояние -> следующий шаг»):
  /start[ deep-link] -> [выбор заведения] -> оценки -> фото -> комментарий -> телефон -> сохранение

Хранилище: Google Sheets, если настроен; иначе локальный reviews.csv.
Фото: храним Telegram file_id (файлы не качаем).
"""

import os
import re
import csv
import ssl
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib import request, error

import certifi

_SSL = ssl.create_default_context(cafile=certifi.where())

from dotenv import load_dotenv
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    KeyboardButton,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ConversationHandler,
    ContextTypes,
    filters,
)

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("feedback-bot")

# --- заведения: ключ deep-link -> название ---
VENUES = {
    "jan": "Джан",
    "hifood": "Hi Food",
}

# --- аспекты оценки, по порядку ---
ASPECTS = [
    ("overall", "Общая оценка"),
    ("taste", "Вкус еды"),
    ("delivery_time", "Время доставки"),
    ("packaging", "Упаковка"),
    ("delivery_speed", "Скорость доставки"),
]

# ссылки на публичные отзывы (показываем довольным клиентам), опционально
PUBLIC_REVIEW_URLS = {
    "jan": os.getenv("PUBLIC_REVIEW_URL_JAN", ""),
    "hifood": os.getenv("PUBLIC_REVIEW_URL_HIFOOD", ""),
}

# колонки таблицы / CSV
COLUMNS = [
    "date", "venue", "name", "phone", "username", "telegram_id",
    "overall", "taste", "delivery_time", "packaging", "delivery_speed",
    "comment", "photo_id", "important",
]

SKIP = "Пропустить ⏭"
LOW_SCORE = 3  # <= LOW_SCORE считаем низкой оценкой

# состояния диалога
MENU, VENUE, RATING, PHOTO, COMMENT, PHONE = range(6)

# кто уже хоть раз запускал бота (в памяти процесса)
_seen: set[int] = set()


# ------------------------- шаги диалога -------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    log.info("START by chat_id=%s name=%s username=%s",
             user.id, user.full_name, user.username)

    arg = context.args[0].lower() if context.args else ""
    returning = user.id in _seen
    _seen.add(user.id)

    # повторный запуск без deep-link -> показываем кнопку «Оставить отзыв»
    if returning and arg not in VENUES:
        keyboard = [[InlineKeyboardButton("📝 Оставить отзыв", callback_data="leave")]]
        await update.message.reply_text(
            "Рады видеть вас снова! 🙌",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        return MENU

    return await begin(update, context, arg)


async def leave_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("Отлично! 🙌")
    return await begin(update, context, "")


async def begin(update: Update, context: ContextTypes.DEFAULT_TYPE, arg: str):
    context.user_data.clear()
    context.user_data["ratings"] = {}
    chat_id = update.effective_chat.id

    # заведение задано deep-link'ом -> сразу к оценкам
    if arg in VENUES:
        context.user_data["venue_key"] = arg
        await context.bot.send_message(
            chat_id,
            f"Спасибо, что заглянули в «{VENUES[arg]}»! 🙏\nПара вопросов — это займёт минуту.",
        )
        return await ask_next_rating(update, context)

    # иначе предлагаем выбрать ресторан
    keyboard = [
        [InlineKeyboardButton(name, callback_data=f"venue:{key}")]
        for key, name in VENUES.items()
    ]
    await context.bot.send_message(
        chat_id,
        "Здравствуйте! Спасибо, что хотите оставить отзыв 🙌\nГде вы были?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return VENUE


async def choose_venue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    context.user_data["venue_key"] = key
    await query.edit_message_text(f"Заведение: «{VENUES[key]}» 👍")
    return await ask_next_rating(update, context)


async def ask_next_rating(update: Update, context: ContextTypes.DEFAULT_TYPE):
    idx = len(context.user_data["ratings"])
    if idx >= len(ASPECTS):
        return await ask_photo(update, context)

    _, label = ASPECTS[idx]
    row = [InlineKeyboardButton(f"{n}", callback_data=f"rate:{n}") for n in range(1, 6)]
    await context.bot.send_message(
        update.effective_chat.id,
        f"Оцените: *{label}*\n1 — плохо, 5 — отлично ⭐",
        reply_markup=InlineKeyboardMarkup([row]),
        parse_mode="Markdown",
    )
    return RATING


async def rate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    value = int(query.data.split(":", 1)[1])
    key, label = ASPECTS[len(context.user_data["ratings"])]
    context.user_data["ratings"][key] = value
    await query.edit_message_text(f"{label}: {'⭐' * value} ({value}/5)")
    return await ask_next_rating(update, context)


async def ask_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = ReplyKeyboardMarkup([[SKIP]], resize_keyboard=True, one_time_keyboard=True)
    await context.bot.send_message(
        update.effective_chat.id,
        "Можете прикрепить фото заказа или упаковки 📷\nИли нажмите «Пропустить».",
        reply_markup=keyboard,
    )
    return PHOTO


async def got_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["photo_id"] = update.message.photo[-1].file_id  # самое крупное
    await update.message.reply_text("Фото получено 📸")
    return await ask_comment(update, context)


async def skip_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["photo_id"] = ""
    return await ask_comment(update, context)


async def photo_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Прикрепите фото 📷 или нажмите «Пропустить».")
    return PHOTO


async def ask_comment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    low = any(v <= LOW_SCORE for v in context.user_data["ratings"].values())
    text = (
        "Жаль, что не всё прошло гладко 🙏\nНапишите, что пошло не так — мы разберёмся."
        if low else
        "Напишите, что понравилось или что можно улучшить ✍️"
    )
    keyboard = ReplyKeyboardMarkup([[SKIP]], resize_keyboard=True, one_time_keyboard=True)
    await context.bot.send_message(update.effective_chat.id, text, reply_markup=keyboard)
    return COMMENT


async def got_comment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    context.user_data["comment"] = "" if text == SKIP else text
    return await ask_phone(update, context)


async def ask_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    contact_btn = KeyboardButton("📱 Поделиться номером", request_contact=True)
    keyboard = ReplyKeyboardMarkup(
        [[contact_btn], [SKIP]], resize_keyboard=True, one_time_keyboard=True
    )
    await context.bot.send_message(
        update.effective_chat.id,
        "Последнее: оставите номер телефона? Это для связи и бонусов 🎁",
        reply_markup=keyboard,
    )
    return PHONE


async def got_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["phone"] = update.message.contact.phone_number
    return await finish(update, context)


async def got_phone_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == SKIP:
        context.user_data["phone"] = ""
        return await finish(update, context)

    digits = re.sub(r"\D", "", text)
    if not (10 <= len(digits) <= 15):
        await update.message.reply_text(
            "Похоже, номер некорректный. Введите ещё раз или нажмите «Пропустить»."
        )
        return PHONE
    context.user_data["phone"] = text
    return await finish(update, context)


async def finish(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    d = context.user_data
    venue_key = d["venue_key"]
    ratings = d["ratings"]
    important = any(v <= LOW_SCORE for v in ratings.values())

    record = {
        "date": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M"),
        "venue": VENUES[venue_key],
        "name": user.full_name,
        "phone": d.get("phone", ""),
        "username": f"@{user.username}" if user.username else "",
        "telegram_id": user.id,
        **{key: ratings.get(key, "") for key, _ in ASPECTS},
        "comment": d.get("comment", ""),
        "photo_id": d.get("photo_id", ""),
        "important": "🔴" if important else "",
    }

    save_record(record)
    await notify_admin(context, record, important)

    await update.message.reply_text(
        "Спасибо за отзыв! 🙌\nНам важно ваше мнение.",
        reply_markup=ReplyKeyboardRemove(),
    )

    url = PUBLIC_REVIEW_URLS.get(venue_key, "")
    if not important and url:
        await update.message.reply_text(
            f"Если было вкусно — будем благодарны за отзыв тут 🌟\n{url}"
        )

    await update.message.reply_text(
        "Хотите оставить ещё один отзыв?",
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("📝 Оставить отзыв", callback_data="leave")]]
        ),
    )
    context.user_data.clear()
    return MENU


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "Отменено. Наберите /start, чтобы начать заново.",
        reply_markup=ReplyKeyboardRemove(),
    )
    return ConversationHandler.END


# ------------------------- хранилище -------------------------

def save_record(record: dict):
    if not post_to_webhook(record):
        append_to_csv(record)


def post_to_webhook(record: dict) -> bool:
    url = os.getenv("SHEETS_WEBHOOK_URL", "")
    if not url:
        return False
    try:
        data = json.dumps(record).encode("utf-8")
        req = request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with request.urlopen(req, timeout=10, context=_SSL) as resp:
            resp.read()
        log.info("Saved to Google Sheets (webhook)")
        return True
    except error.URLError as e:
        log.error("Webhook write failed: %s", e)
        return False


def append_to_csv(record: dict):
    path = Path(__file__).parent / "reviews.csv"
    new_file = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        if new_file:
            writer.writeheader()
        writer.writerow(record)
    log.info("Saved to %s", path.name)


# ------------------------- уведомление админу -------------------------

async def notify_admin(context: ContextTypes.DEFAULT_TYPE, r: dict, important: bool):
    if not ADMIN_CHAT_ID:
        return

    header = "🔴 ВАЖНЫЙ ОТЗЫВ" if important else "🆕 Новый отзыв"
    contact = " · ".join(filter(None, [r["username"], r["phone"], f"id{r['telegram_id']}"]))
    text = "\n".join([
        header, "",
        f"Заведение: {r['venue']}",
        f"Имя: {r['name']}",
        f"Контакт: {contact}", "",
        f"Общая {r['overall']} · Вкус {r['taste']} · Время {r['delivery_time']} · "
        f"Упаковка {r['packaging']} · Скорость {r['delivery_speed']}", "",
        f"Комментарий: {r['comment'] or '—'}",
        f"Фото: {'есть' if r['photo_id'] else 'нет'}",
    ])
    try:
        if r["photo_id"]:
            await context.bot.send_photo(ADMIN_CHAT_ID, r["photo_id"], caption=text)
        else:
            await context.bot.send_message(ADMIN_CHAT_ID, text)
    except Exception as e:
        log.error("Admin notify failed: %s", e)


# ------------------------- запуск -------------------------

def build_app() -> Application:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            MENU: [CallbackQueryHandler(leave_review, pattern=r"^leave$")],
            VENUE: [CallbackQueryHandler(choose_venue, pattern=r"^venue:")],
            RATING: [CallbackQueryHandler(rate, pattern=r"^rate:")],
            PHOTO: [
                MessageHandler(filters.PHOTO, got_photo),
                MessageHandler(filters.Regex(f"^{re.escape(SKIP)}$"), skip_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, photo_prompt),
            ],
            COMMENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, got_comment)],
            PHONE: [
                MessageHandler(filters.CONTACT, got_contact),
                MessageHandler(filters.TEXT & ~filters.COMMAND, got_phone_text),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,  # /start в любой момент начинает заново
    ))
    return app


def start_health_server():
    """На Render сервис обязан слушать порт. Локально (нет PORT) — пропускаем."""
    port = int(os.getenv("PORT", "0"))
    if not port:
        return

    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")

        def log_message(self, *args):
            pass

    server = HTTPServer(("0.0.0.0", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("Health server listening on :%s", port)


def main():
    log.info("Bot starting…")
    start_health_server()
    build_app().run_polling()


if __name__ == "__main__":
    main()
