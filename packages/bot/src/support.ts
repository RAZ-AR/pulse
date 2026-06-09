/**
 * ayoo Support / Admin bot (@ayoo_support_bot)
 *
 * Receives:
 *   - partner applications from the landing form (Accept / Reject inline buttons)
 *   - error & problem reports from the app / API
 *
 * Access control: only chat ids listed in SUPPORT_ADMIN_CHAT_IDS can see content
 * and react. The first id is the owner. Add teammates by adding their chat id.
 *
 * Env:
 *   SUPPORT_TELEGRAM_BOT_TOKEN   bot token from @BotFather
 *   SUPPORT_ADMIN_CHAT_IDS       comma-separated chat ids, e.g. "12345,67890"
 */
import { Telegraf } from "telegraf"

const token = process.env.SUPPORT_TELEGRAM_BOT_TOKEN
export const isSupportBotConfigured = Boolean(token)

export const supportBot = new Telegraf(token ?? "0:missing-support-token")

// ── Admin allow-list ──────────────────────────────────────
function adminIds(): string[] {
  return (process.env.SUPPORT_ADMIN_CHAT_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean)
}
function isAdmin(id: string | number | undefined): boolean {
  return id != null && adminIds().includes(String(id))
}

function esc(s: string): string {
  // Escape Telegram MarkdownV1 specials lightly (we use plain Markdown)
  return String(s ?? "").replace(/([*_`\[])/g, "\\$1")
}

// ── Outbound: notify all admins ───────────────────────────
type Extra = Parameters<typeof supportBot.telegram.sendMessage>[2]

export async function notifyAdmins(text: string, extra?: Extra): Promise<void> {
  if (!isSupportBotConfigured) {
    console.warn("[support] bot not configured — skipping notify")
    return
  }
  await Promise.all(
    adminIds().map((id) =>
      supportBot.telegram.sendMessage(id, text, { parse_mode: "Markdown", ...(extra ?? {}) })
        .catch((e) => console.error("[support] sendMessage failed for", id, e?.message))
    )
  )
}

// ── Partner application ───────────────────────────────────
export type PartnerLead = {
  name: string
  contact: string
  source?: string | undefined
  lang?: string | undefined
}

export async function sendPartnerLead(lead: PartnerLead): Promise<void> {
  const text =
    `🏪 *New partner application*\n\n` +
    `*Venue:* ${esc(lead.name)}\n` +
    `*Contact:* ${esc(lead.contact)}\n` +
    `*Lang:* ${esc(lead.lang ?? "—")}  ·  *Source:* ${esc(lead.source ?? "landing")}\n` +
    `_${new Date().toLocaleString("ru-RU")}_`
  await notifyAdmins(text, {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Accept", callback_data: "lead:accept" },
        { text: "❌ Reject", callback_data: "lead:reject" },
      ]],
    },
  })
}

// ── Error / problem report ────────────────────────────────
export type ErrorReport = {
  message: string
  context?: string | undefined
  source?: string | undefined
  userId?: string | undefined
}

export async function sendErrorReport(report: ErrorReport): Promise<void> {
  const text =
    `🐛 *Problem report*\n\n` +
    `${esc(report.message).slice(0, 1500)}\n\n` +
    (report.context ? `*Context:* ${esc(report.context).slice(0, 400)}\n` : "") +
    (report.userId ? `*User:* \`${esc(report.userId)}\`\n` : "") +
    `*Source:* ${esc(report.source ?? "app")}  ·  _${new Date().toLocaleString("ru-RU")}_`
  await notifyAdmins(text)
}

// ── Inbound handlers ──────────────────────────────────────

supportBot.start(async (ctx) => {
  const id = ctx.chat?.id
  if (!isAdmin(id)) {
    await ctx.reply(
      `🔒 This is the ayoo admin bot. You're not authorized.\n\n` +
      `Your chat id: ${id}\nAsk the owner to add it.`
    )
    return
  }
  await ctx.reply(
    `👋 *ayoo Support*\n\n` +
    `Partner applications and problem reports arrive here.\n` +
    `Use ✅ / ❌ on each application to accept or reject.\n\n` +
    `/id — show your chat id\n` +
    `/admins — list current admins`,
    { parse_mode: "Markdown" }
  )
})

supportBot.command("id", async (ctx) => {
  await ctx.reply(`Your chat id: \`${ctx.chat?.id}\``, { parse_mode: "Markdown" })
})

supportBot.command("admins", async (ctx) => {
  if (!isAdmin(ctx.chat?.id)) return
  const ids = adminIds()
  await ctx.reply(
    `👥 Admins (${ids.length}):\n` + ids.map((x, i) => `${i === 0 ? "👑" : "•"} \`${x}\``).join("\n") +
    `\n\nTo add someone: ask them to /start this bot, copy their id, and add it to SUPPORT_ADMIN_CHAT_IDS.`,
    { parse_mode: "Markdown" }
  )
})

// Accept / reject an application — admin-guarded, edits the message in place.
supportBot.action(/^lead:(accept|reject)$/, async (ctx) => {
  const id = ctx.chat?.id
  if (!isAdmin(id)) {
    await ctx.answerCbQuery("Not authorized", { show_alert: true })
    return
  }
  const decision = ctx.match[1] === "accept" ? "✅ ACCEPTED" : "❌ REJECTED"
  const who = ctx.from?.first_name ?? ctx.from?.username ?? String(id)
  const original = (ctx.callbackQuery.message as { text?: string } | undefined)?.text ?? ""
  await ctx.editMessageText(
    `${original}\n\n${decision} by ${esc(who)} · ${new Date().toLocaleString("ru-RU")}`,
    { parse_mode: "Markdown" }
  ).catch(() => {})
  await ctx.answerCbQuery(decision)
})
