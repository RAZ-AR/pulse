/**
 * POST /api/merchant-tg-register
 *
 * Creates a new Merchant + Venue from the Mini App registration form.
 * Validates Telegram initData signature, then saves to DB with status PENDING.
 */
import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { db } from "@pulse/db"

function validateTelegramInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null

  params.delete("hash")
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (expectedHash !== hash) return null
  return Object.fromEntries(params)
}

function toVenueCategory(c: string): "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "FITNESS" | "OTHER" {
  const map: Record<string, "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "FITNESS" | "OTHER"> = {
    CAFE: "CAFE", RESTAURANT: "RESTAURANT", RETAIL: "RETAIL", SERVICE: "SERVICE", FITNESS: "FITNESS", OTHER: "OTHER",
  }
  return map[c] ?? "OTHER"
}

function normalizeSerbianPib(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : ""
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { initData, name, category, city, address, rate } = body
    const taxId = normalizeSerbianPib(body.taxId)

    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ error: "initData required" }, { status: 400 })
    }

    const botToken = process.env.PARTNER_TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "Bot not configured" }, { status: 500 })
    }

    const data = validateTelegramInitData(initData, botToken)
    if (!data) {
      return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 })
    }

    let tgUser: { id: number; first_name?: string }
    try {
      tgUser = JSON.parse(data.user ?? "{}")
    } catch {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 })
    }

    const telegramId = String(tgUser.id)
    if (!telegramId || telegramId === "undefined") {
      return NextResponse.json({ error: "No Telegram ID" }, { status: 400 })
    }

    if (!name || !category || !city || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const parsedRate = parseFloat(rate)
    if (isNaN(parsedRate) || parsedRate <= 0) {
      return NextResponse.json({ error: "Invalid rate" }, { status: 400 })
    }
    const pointsPerCurrency = Math.max(0.01, parsedRate)
    if (taxId && taxId.length !== 9) {
      return NextResponse.json({ error: "PIB must contain 9 digits" }, { status: 400 })
    }

    const lat = typeof body.lat === "number" ? body.lat : 0
    const lng = typeof body.lng === "number" ? body.lng : 0
    const sourcePlaceId = typeof body.sourcePlaceId === "string" ? body.sourcePlaceId.trim() : ""

    // Check for existing registration by Telegram ID
    const existing = await db.merchant.findFirst({
      where: { telegramChatId: telegramId },
    })
    if (existing) {
      return NextResponse.json({ error: "Already registered" }, { status: 409 })
    }

    const existingVenue = sourcePlaceId
      ? await db.venue.findUnique({
          where: { sourceProvider_sourcePlaceId: { sourceProvider: "google_maps", sourcePlaceId } },
          select: { id: true, ownerId: true },
        })
      : null
    if (existingVenue?.ownerId) {
      return NextResponse.json({ error: "This venue is already registered" }, { status: 409 })
    }

    // Social links from form
    const socials = body.socials ?? {}

    // Logo: base64 data URL (max ~200KB after browser resize)
    const logoUrl: string | null = body.logoUrl ?? null

    // Create merchant + venue in transaction
    await db.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: name.trim(),
          address: `${city}, ${address.trim()}`,
          taxId: taxId || null,
          taxIdNormalized: taxId || null,
          email: null,          // email not collected at registration
          telegramChatId: telegramId,
          status: "PENDING",
          pointsBalance: 0,
          logoUrl,
        },
      })

      const venueData = {
          name: name.trim(),
          category: toVenueCategory(category),
          description: "Registered via ayoo Partner Mini App",
          address: address.trim(),
          city: city.trim(),
          country: "Serbia",
          lat,
          lng,
          photos: [],
          ownerId: merchant.id,
          isPartner: true,
          partnerSince: new Date(),
          pointsPerCurrency,
          currency: "RSD",
          ...(sourcePlaceId ? { sourceProvider: "google_maps", sourcePlaceId } : {}),
          phone: socials.phone?.trim() || null,
          website: socials.website?.trim() || null,
          instagram: socials.instagram?.trim() || null,
          tiktok: socials.tiktok?.trim() || null,
          telegram: socials.telegram?.trim() || null,
          googleMapsUrl: socials.googleMapsUrl?.trim() || null,
      }

      if (existingVenue) {
        await tx.venue.update({ where: { id: existingVenue.id }, data: venueData })
      } else {
        await tx.venue.create({ data: venueData })
      }
    })

    // Notify admin with inline action buttons
    const adminId = process.env.ADMIN_CHAT_ID
    if (adminId && botToken) {
      const rateLabel = `${Math.round(pointsPerCurrency * 1000)} pts / 1000 RSD`
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          parse_mode: "Markdown",
          text:
            `🆕 *Новая заявка (Mini App)*\n\n` +
            `🏪 *${name}* (${category})\n` +
            `📍 ${city}, ${address}\n` +
            (socials.phone ? `📞 ${socials.phone}\n` : "") +
            (socials.instagram ? `📸 ${socials.instagram}\n` : "") +
            `🪪 PIB: ${taxId || "—"}\n` +
            `⭐ ${rateLabel}\n` +
            `TG: \`${telegramId}\``,
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Принять",   callback_data: `approve_${telegramId}` },
              { text: "❌ Отклонить", callback_data: `reject_${telegramId}` },
              { text: "⏸ Подождать", callback_data: `hold_${telegramId}` },
            ]],
          },
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("merchant-tg-register error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
