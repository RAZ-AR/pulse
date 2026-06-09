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

# --- языки: код -> подпись кнопки ---
LANGS = {"ru": "Русский 🇷🇺", "en": "English 🇬🇧", "sr": "Srpski 🇷🇸"}
DEFAULT_LANG = "ru"

# аспекты оценки (порядок фиксирован; подписи — в переводах)
ASPECT_KEYS = ["overall", "taste", "delivery_time", "packaging", "delivery_speed"]

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

# --- переводы всех сообщений ---
T = {
    "ru": {
        "welcome_venue": "Здравствуйте! Спасибо, что хотите оставить отзыв 🙌\nГде вы были?",
        "thanks_deeplink": "Спасибо, что заглянули в «{venue}»! 🙏\nПара вопросов — это займёт минуту.",
        "venue_picked": "Заведение: «{venue}» 👍",
        "returning": "Рады видеть вас снова! 🙌",
        "leave_review": "📝 Оставить отзыв",
        "great": "Отлично! 🙌",
        "rate": "Оцените: *{label}*\n1 — плохо, 5 — отлично ⭐",
        "rated": "{label}: {stars} ({v}/5)",
        "photo_ask": "Можете прикрепить фото заказа или упаковки 📷\nИли нажмите «Пропустить».",
        "photo_got": "Фото получено 📸",
        "photo_retry": "Прикрепите фото 📷 или нажмите «Пропустить».",
        "comment_low": "Жаль, что не всё прошло гладко 🙏\nНапишите, что пошло не так — мы разберёмся.",
        "comment_ok": "Напишите, что понравилось или что можно улучшить ✍️",
        "phone_ask": "Последнее: оставите номер телефона? Это для связи и бонусов 🎁",
        "phone_btn": "📱 Поделиться номером",
        "phone_bad": "Похоже, номер некорректный. Введите ещё раз или нажмите «Пропустить».",
        "thanks": "Спасибо за отзыв! 🙌\nНам важно ваше мнение.",
        "public": "Если было вкусно — будем благодарны за отзыв тут 🌟\n{url}",
        "again": "Хотите оставить ещё один отзыв?",
        "cancelled": "Отменено. Наберите /start, чтобы начать заново.",
        "skip": "Пропустить ⏭",
        "aspects": {
            "overall": "Общая оценка", "taste": "Вкус еды",
            "delivery_time": "Время доставки", "packaging": "Упаковка",
            "delivery_speed": "Скорость доставки",
        },
    },
    "en": {
        "welcome_venue": "Hello! Thanks for leaving a review 🙌\nWhere did you visit?",
        "thanks_deeplink": "Thanks for visiting «{venue}»! 🙏\nJust a few questions — it'll take a minute.",
        "venue_picked": "Venue: «{venue}» 👍",
        "returning": "Great to see you again! 🙌",
        "leave_review": "📝 Leave a review",
        "great": "Great! 🙌",
        "rate": "Rate: *{label}*\n1 — poor, 5 — excellent ⭐",
        "rated": "{label}: {stars} ({v}/5)",
        "photo_ask": "You can attach a photo of your order or packaging 📷\nOr tap «Skip».",
        "photo_got": "Photo received 📸",
        "photo_retry": "Attach a photo 📷 or tap «Skip».",
        "comment_low": "Sorry it didn't go smoothly 🙏\nTell us what went wrong — we'll look into it.",
        "comment_ok": "Tell us what you liked or what we can improve ✍️",
        "phone_ask": "Last thing: would you share your phone number? For contact and bonuses 🎁",
        "phone_btn": "📱 Share phone number",
        "phone_bad": "That number looks invalid. Please try again or tap «Skip».",
        "thanks": "Thanks for your review! 🙌\nYour opinion matters to us.",
        "public": "If it was tasty — we'd appreciate a review here 🌟\n{url}",
        "again": "Would you like to leave another review?",
        "cancelled": "Cancelled. Type /start to begin again.",
        "skip": "Skip ⏭",
        "aspects": {
            "overall": "Overall", "taste": "Food taste",
            "delivery_time": "Delivery time", "packaging": "Packaging",
            "delivery_speed": "Delivery speed",
        },
    },
    "sr": {
        "welcome_venue": "Zdravo! Hvala što želite da ostavite recenziju 🙌\nGde ste bili?",
        "thanks_deeplink": "Hvala što ste posetili «{venue}»! 🙏\nSamo nekoliko pitanja — trajaće minut.",
        "venue_picked": "Objekat: «{venue}» 👍",
        "returning": "Drago nam je da vas ponovo vidimo! 🙌",
        "leave_review": "📝 Ostavi recenziju",
        "great": "Odlično! 🙌",
        "rate": "Ocenite: *{label}*\n1 — loše, 5 — odlično ⭐",
        "rated": "{label}: {stars} ({v}/5)",
        "photo_ask": "Možete priložiti fotografiju porudžbine ili pakovanja 📷\nIli pritisnite «Preskoči».",
        "photo_got": "Fotografija primljena 📸",
        "photo_retry": "Priložite fotografiju 📷 ili pritisnite «Preskoči».",
        "comment_low": "Žao nam je što nije sve prošlo glatko 🙏\nNapišite šta nije bilo u redu — proverićemo.",
        "comment_ok": "Napišite šta vam se svidelo ili šta možemo da poboljšamo ✍️",
        "phone_ask": "Poslednje: da li biste ostavili broj telefona? Za kontakt i bonuse 🎁",
        "phone_btn": "📱 Podeli broj telefona",
        "phone_bad": "Broj izgleda neispravno. Pokušajte ponovo ili pritisnite «Preskoči».",
        "thanks": "Hvala na recenziji! 🙌\nVaše mišljenje nam je važno.",
        "public": "Ako je bilo ukusno — bili bismo zahvalni na recenziji ovde 🌟\n{url}",
        "again": "Želite li da ostavite još jednu recenziju?",
        "cancelled": "Otkazano. Ukucajte /start da počnete ponovo.",
        "skip": "Preskoči ⏭",
        "aspects": {
            "overall": "Ukupna ocena", "taste": "Ukus hrane",
            "delivery_time": "Vreme dostave", "packaging": "Pakovanje",
            "delivery_speed": "Brzina dostave",
        },
    },
}

# все варианты кнопки «Пропустить» (для распознавания на любом языке)
ALL_SKIPS = {T[code]["skip"] for code in T}
SKIP_RE = "^(" + "|".join(re.escape(s) for s in ALL_SKIPS) + ")$"

LOW_SCORE = 3  # <= LOW_SCORE считаем низкой оценкой


def lang_of(context) -> str:
    return context.user_data.get("lang", DEFAULT_LANG)


def tr(context, key: str) -> str:
    return T[lang_of(context)][key]


# состояния диалога
LANG, MENU, VENUE, RATING, PHOTO, COMMENT, PHONE = range(7)

# в памяти процесса
_seen: set[int] = set()        # кто уже запускал бота
_lang: dict[int, str] = {}     # выбранный язык по telegram_id


# ------------------------- шаги диалога -------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    log.info("START by chat_id=%s name=%s username=%s",
             user.id, user.full_name, user.username)

    arg = context.args[0].lower() if context.args else ""
    returning = user.id in _seen
    _seen.add(user.id)

    # повторный запуск без deep-link -> кнопка «Оставить отзыв» на прежнем языке
    if returning and arg not in VENUES:
        context.user_data["lang"] = _lang.get(user.id, DEFAULT_LANG)
        keyboard = [[InlineKeyboardButton(tr(context, "leave_review"), callback_data="leave")]]
        await update.message.reply_text(
            tr(context, "returning"),
            reply_markup=InlineKeyboardMarkup(keyboard),
        )
        return MENU

    # первый запуск (или deep-link) -> сначала выбор языка
    context.user_data["start_arg"] = arg
    keyboard = [
        [InlineKeyboardButton(label, callback_data=f"lang:{code}")]
        for code, label in LANGS.items()
    ]
    await update.message.reply_text(
        "Выберите язык / Choose language / Izaberite jezik:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return LANG


async def choose_language(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    code = query.data.split(":", 1)[1]
    context.user_data["lang"] = code
    _lang[update.effective_user.id] = code
    arg = context.user_data.get("start_arg", "")
    await query.edit_message_text(LANGS[code])
    return await begin(update, context, arg)


async def leave_review(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(tr(context, "great"))
    return await begin(update, context, "")


async def begin(update: Update, context: ContextTypes.DEFAULT_TYPE, arg: str):
    lang = lang_of(context)
    context.user_data.clear()
    context.user_data["lang"] = lang
    context.user_data["ratings"] = {}
    chat_id = update.effective_chat.id

    # заведение задано deep-link'ом -> сразу к оценкам
    if arg in VENUES:
        context.user_data["venue_key"] = arg
        await context.bot.send_message(
            chat_id, tr(context, "thanks_deeplink").format(venue=VENUES[arg])
        )
        return await ask_next_rating(update, context)

    # иначе предлагаем выбрать ресторан
    keyboard = [
        [InlineKeyboardButton(name, callback_data=f"venue:{key}")]
        for key, name in VENUES.items()
    ]
    await context.bot.send_message(
        chat_id, tr(context, "welcome_venue"), reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return VENUE


async def choose_venue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    context.user_data["venue_key"] = key
    await query.edit_message_text(tr(context, "venue_picked").format(venue=VENUES[key]))
    return await ask_next_rating(update, context)


async def ask_next_rating(update: Update, context: ContextTypes.DEFAULT_TYPE):
    idx = len(context.user_data["ratings"])
    if idx >= len(ASPECT_KEYS):
        return await ask_photo(update, context)

    label = tr(context, "aspects")[ASPECT_KEYS[idx]]
    row = [InlineKeyboardButton(f"{n}", callback_data=f"rate:{n}") for n in range(1, 6)]
    await context.bot.send_message(
        update.effective_chat.id,
        tr(context, "rate").format(label=label),
        reply_markup=InlineKeyboardMarkup([row]),
        parse_mode="Markdown",
    )
    return RATING


async def rate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    value = int(query.data.split(":", 1)[1])
    key = ASPECT_KEYS[len(context.user_data["ratings"])]
    context.user_data["ratings"][key] = value
    label = tr(context, "aspects")[key]
    await query.edit_message_text(
        tr(context, "rated").format(label=label, stars="⭐" * value, v=value)
    )
    return await ask_next_rating(update, context)


async def ask_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = ReplyKeyboardMarkup(
        [[tr(context, "skip")]], resize_keyboard=True, one_time_keyboard=True
    )
    await context.bot.send_message(
        update.effective_chat.id, tr(context, "photo_ask"), reply_markup=keyboard
    )
    return PHOTO


async def got_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["photo_id"] = update.message.photo[-1].file_id  # самое крупное
    await update.message.reply_text(tr(context, "photo_got"))
    return await ask_comment(update, context)


async def skip_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["photo_id"] = ""
    return await ask_comment(update, context)


async def photo_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(tr(context, "photo_retry"))
    return PHOTO


async def ask_comment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    low = any(v <= LOW_SCORE for v in context.user_data["ratings"].values())
    text = tr(context, "comment_low") if low else tr(context, "comment_ok")
    keyboard = ReplyKeyboardMarkup(
        [[tr(context, "skip")]], resize_keyboard=True, one_time_keyboard=True
    )
    await context.bot.send_message(update.effective_chat.id, text, reply_markup=keyboard)
    return COMMENT


async def got_comment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    context.user_data["comment"] = "" if text in ALL_SKIPS else text
    return await ask_phone(update, context)


async def ask_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    contact_btn = KeyboardButton(tr(context, "phone_btn"), request_contact=True)
    keyboard = ReplyKeyboardMarkup(
        [[contact_btn], [tr(context, "skip")]], resize_keyboard=True, one_time_keyboard=True
    )
    await context.bot.send_message(
        update.effective_chat.id, tr(context, "phone_ask"), reply_markup=keyboard
    )
    return PHONE


async def got_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["phone"] = update.message.contact.phone_number
    return await finish(update, context)


async def got_phone_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text in ALL_SKIPS:
        context.user_data["phone"] = ""
        return await finish(update, context)

    digits = re.sub(r"\D", "", text)
    if not (10 <= len(digits) <= 15):
        await update.message.reply_text(tr(context, "phone_bad"))
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
        **{key: ratings.get(key, "") for key in ASPECT_KEYS},
        "comment": d.get("comment", ""),
        "photo_id": d.get("photo_id", ""),
        "important": "🔴" if important else "",
    }

    save_record(record)
    await notify_admin(context, record, important)

    await update.message.reply_text(
        tr(context, "thanks"), reply_markup=ReplyKeyboardRemove()
    )

    url = PUBLIC_REVIEW_URLS.get(venue_key, "")
    if not important and url:
        await update.message.reply_text(tr(context, "public").format(url=url))

    await update.message.reply_text(
        tr(context, "again"),
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton(tr(context, "leave_review"), callback_data="leave")]]
        ),
    )

    lang = lang_of(context)
    context.user_data.clear()
    context.user_data["lang"] = lang  # сохраняем язык для повторного отзыва
    return MENU


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = tr(context, "cancelled")
    context.user_data.clear()
    await update.message.reply_text(text, reply_markup=ReplyKeyboardRemove())
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
            LANG: [CallbackQueryHandler(choose_language, pattern=r"^lang:")],
            MENU: [CallbackQueryHandler(leave_review, pattern=r"^leave$")],
            VENUE: [CallbackQueryHandler(choose_venue, pattern=r"^venue:")],
            RATING: [CallbackQueryHandler(rate, pattern=r"^rate:")],
            PHOTO: [
                MessageHandler(filters.PHOTO, got_photo),
                MessageHandler(filters.Regex(SKIP_RE), skip_photo),
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


def start_keep_alive():
    """Бесплатный Render засыпает без входящего трафика -> пингуем себя сами."""
    url = os.getenv("RENDER_EXTERNAL_URL", "")
    if not url:
        return

    import time
    import threading

    def loop():
        while True:
            time.sleep(600)  # каждые 10 минут (idle-таймаут Render — 15 мин)
            try:
                request.urlopen(url, timeout=10, context=_SSL).read()
            except Exception as e:
                log.warning("keep-alive ping failed: %s", e)

    threading.Thread(target=loop, daemon=True).start()
    log.info("Keep-alive: пингуем %s каждые 10 мин", url)


def main():
    log.info("Bot starting…")
    start_health_server()
    start_keep_alive()
    build_app().run_polling()


if __name__ == "__main__":
    main()
