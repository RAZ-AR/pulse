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

function toVenueCategory(c: string): "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" {
  const map: Record<string, "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER"> = {
    CAFE: "CAFE", RESTAURANT: "RESTAURANT", RETAIL: "RETAIL", SERVICE: "SERVICE", OTHER: "OTHER",
  }
  return map[c] ?? "OTHER"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { initData, name, category, city, address, phone, email, taxId, rate } = body

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

    if (!name || !category || !city || !address || !phone || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const pointsPerCurrency = parseFloat(rate)
    if (isNaN(pointsPerCurrency) || pointsPerCurrency <= 0) {
      return NextResponse.json({ error: "Invalid rate" }, { status: 400 })
    }

    // Check for existing registration
    const existing = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: telegramId }, { email: email.toLowerCase().trim() }] },
    })
    if (existing) {
      return NextResponse.json({ error: "Already registered" }, { status: 409 })
    }

    // Create merchant + venue in transaction
    await db.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: name.trim(),
          address: `${city}, ${address.trim()}`,
          taxId: taxId?.trim() || null,
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          telegramChatId: telegramId,
          status: "PENDING",
          pointsBalance: 0,
        },
      })

      await tx.venue.create({
        data: {
          name: name.trim(),
          category: toVenueCategory(category),
          description: "Registered via ayoo Partner Mini App",
          address: address.trim(),
          city: city.trim(),
          country: "Serbia",
          lat: 0,
          lng: 0,
          photos: [],
          ownerId: merchant.id,
          isPartner: true,
          partnerSince: new Date(),
          pointsPerCurrency,
          currency: "RSD",
          phone: phone?.trim() || null,
        },
      })
    })

    // Notify admin
    const adminId = process.env.ADMIN_CHAT_ID
    if (adminId && botToken) {
      const rateLabel = `${Math.round(pointsPerCurrency * 1000)} pts / 1000 RSD`
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text:
            `🆕 Новая заявка (Mini App)\n\n` +
            `🏪 ${name} (${category})\n` +
            `📍 ${city}, ${address}\n` +
            `📞 ${phone}\n📧 ${email}\n` +
            `🪪 PIB: ${taxId || "—"}\n⭐ ${rateLabel}\n` +
            `TG: ${telegramId}\n\n/admin activate ${telegramId}`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("merchant-tg-register error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
