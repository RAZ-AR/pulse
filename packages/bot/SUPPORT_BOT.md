# ayoo Support / Admin bot

`@ayoo_support_bot` — receives partner applications (with Accept/Reject) and
error/problem reports. Only admins in `SUPPORT_ADMIN_CHAT_IDS` can see/react.

## 1. Create the bot (one time)

1. Open Telegram → **@BotFather** → `/newbot`.
2. Name: `ayoo Support`, username: `ayoo_support_bot` (or any free one).
3. Copy the **token**.

## 2. Get your chat id

DM the new bot `/start` (it'll say "not authorized" + show your chat id), or
message **@userinfobot**. Copy the numeric id.

## 3. Set env vars (Vercel → api project → Settings → Environment Variables)

```
SUPPORT_TELEGRAM_BOT_TOKEN = <token from BotFather>
SUPPORT_ADMIN_CHAT_IDS     = <your-chat-id>          # add more: 111,222,333
```

Redeploy the **api** app so the new routes pick up the env.

## 4. Point the webhook at the API

```bash
TOKEN="<token>"
curl "https://api.telegram.org/bot${TOKEN}/setWebhook?url=https://api.ayoo.space/api/support-bot"
```

Verify: `curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"`

## 5. Done

- Landing partner form → `POST /api/partner-lead` → appears in the bot with
  ✅ Accept / ❌ Reject buttons.
- Errors/problems → `POST /api/support-report` `{ message, context?, source?, userId? }`.

## Adding teammates

Ask them to `/start` the bot, send you their chat id (shown in the reply), and
add it to `SUPPORT_ADMIN_CHAT_IDS`. Use `/admins` in the bot to see the list.
