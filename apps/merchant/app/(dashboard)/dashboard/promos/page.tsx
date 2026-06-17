"use client"

import { useState } from "react"
import { trpc } from "../../../../src/lib/trpc"

// ── QR image via free public API (no auth, no sensitive data) ──
function qrSrc(token: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(`ayoo://offer/${token}`)}`
}

function localDatetime(date?: Date | string | null) {
  if (!date) return ""
  const d = new Date(date)
  // format for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusBadge(offer: { active: boolean; endsAt: Date | null; usageLimit: number | null; usageCount: number }) {
  const now = new Date()
  if (!offer.active) return <Badge color="gray">Деактивирован</Badge>
  if (offer.endsAt && offer.endsAt < now) return <Badge color="red">Истёк</Badge>
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) return <Badge color="orange">Лимит исчерпан</Badge>
  return <Badge color="green">Активен</Badge>
}

function Badge({ color, children }: { color: "green" | "orange" | "red" | "gray"; children: React.ReactNode }) {
  const colors = {
    green:  "bg-green-50  text-green-700  border-green-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red:    "bg-red-50    text-red-700    border-red-200",
    gray:   "bg-gray-50   text-gray-500   border-gray-200",
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {children}
    </span>
  )
}

// ── Form state ────────────────────────────────────────────────

const emptyForm = () => ({
  venueId:     "",
  title:       "",
  points:      "100",
  startsAt:    "",
  endsAt:      "",
  usageLimit:  "",
})

// ── Page ──────────────────────────────────────────────────────

export default function PromosPage() {
  const { data: venues }  = trpc.merchant.myVenues.useQuery()
  const { data: promos, refetch } = trpc.offer.mine.useQuery()

  const createMutation     = trpc.offer.create.useMutation({ onSuccess: () => { refetch(); setCreatedToken(null) } })
  const deactivateMutation = trpc.offer.deactivate.useMutation({ onSuccess: () => refetch() })

  const [form, setForm]             = useState(emptyForm)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const venueList = venues ?? []
  const currentVenueId = form.venueId || venueList[0]?.id || ""

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const points = parseInt(form.points)
    if (!currentVenueId || !form.title.trim() || isNaN(points) || points < 1) return

    try {
      const res = await createMutation.mutateAsync({
        venueId:      currentVenueId,
        title:        form.title.trim(),
        pointsReward: points,
        startsAt:     form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt:       form.endsAt   ? new Date(form.endsAt).toISOString()   : undefined,
        usageLimit:   form.usageLimit ? parseInt(form.usageLimit) : undefined,
      })
      setCreatedToken(res.qrToken)
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating promo")
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1115]">Promo QR</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Генерация QR-кодов для промо-акций · каждый пользователь может использовать 1 раз
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setCreatedToken(null) }}
          className="px-4 py-2 bg-[#0F1115] text-white text-sm font-semibold rounded-xl hover:bg-[#1F2937] transition-colors"
        >
          {showForm ? "Закрыть" : "+ Новая акция"}
        </button>
      </div>

      {/* ── Newly created QR ── */}
      {createdToken && (
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-6">
          <img src={qrSrc(createdToken)} alt="QR код акции" className="w-40 h-40 rounded-lg border border-green-200" />
          <div className="flex-1">
            <p className="text-green-800 font-semibold mb-1">✅ Акция создана!</p>
            <p className="text-sm text-green-700 mb-3">Распечатай или скачай QR и размести в заведении.</p>
            <a
              href={qrSrc(createdToken)}
              download="ayoo-promo-qr.png"
              className="inline-block px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-colors"
            >
              ↓ Скачать PNG
            </a>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-[#0F1115] mb-5">Новая промо-акция</h2>

          <div className="grid grid-cols-2 gap-4">

            {/* Venue */}
            {venueList.length > 1 && (
              <div className="col-span-2">
                <Label>Заведение</Label>
                <select
                  value={form.venueId || currentVenueId}
                  onChange={e => setForm(f => ({ ...f, venueId: e.target.value }))}
                  className={input}
                >
                  {venueList.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div className="col-span-2">
              <Label>Название акции</Label>
              <input
                required
                type="text"
                placeholder="Напр. «Первый визит — 200 баллов»"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={input}
              />
            </div>

            {/* Points */}
            <div>
              <Label>Бонусных баллов</Label>
              <input
                required
                type="number"
                min={1}
                value={form.points}
                onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                className={input}
              />
            </div>

            {/* Usage limit */}
            <div>
              <Label>Макс. использований (пусто = ∞)</Label>
              <input
                type="number"
                min={1}
                placeholder="∞"
                value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                className={input}
              />
            </div>

            {/* startsAt */}
            <div>
              <Label>Активна с (пусто = сейчас)</Label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className={input}
              />
            </div>

            {/* endsAt */}
            <div>
              <Label>Активна до (пусто = бессрочно)</Label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className={input}
              />
            </div>

            {/* Per-user note */}
            <div className="col-span-2 flex items-center gap-2 text-sm text-[#6B7280] bg-[#F9FAFB] rounded-xl px-4 py-3">
              <span className="text-green-600 font-bold">✓</span>
              Каждый пользователь может использовать акцию только 1 раз
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full py-3 bg-[#fd4600] text-white font-bold rounded-xl hover:bg-[#c83700] transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Создаём…" : "Создать и получить QR"}
              </button>
            </div>

          </div>
        </form>
      )}

      {/* ── Promo list ── */}
      <div className="space-y-3">
        {promos === undefined && (
          <p className="text-sm text-[#6B7280]">Загрузка…</p>
        )}
        {promos?.length === 0 && (
          <div className="text-center py-12 text-sm text-[#9CA3AF]">
            Акций пока нет. Нажми «+ Новая акция» чтобы создать первую.
          </div>
        )}
        {promos?.map(offer => {
          const isExpanded = expandedId === offer.id
          return (
            <div key={offer.id} className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : offer.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-[#0F1115] truncate">{offer.title}</p>
                    {statusBadge(offer)}
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    <span className="font-medium text-[#015634]">+{offer.pointsReward} pts</span>
                    {" · "}{offer._count.redemptions} использований
                    {offer.usageLimit !== null && ` / ${offer.usageLimit}`}
                    {offer.endsAt && ` · до ${new Date(offer.endsAt).toLocaleDateString("ru-RU")}`}
                  </p>
                </div>
                <span className="text-[#9CA3AF] text-xs">{isExpanded ? "▲" : "▼"}</span>
              </div>

              {/* Expanded: QR + controls */}
              {isExpanded && (
                <div className="border-t border-[#E5E7EB] px-5 py-5 flex items-start gap-6">
                  <img
                    src={qrSrc(offer.qrToken)}
                    alt="QR акции"
                    className="w-36 h-36 rounded-xl border border-[#E5E7EB] flex-shrink-0"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-[#6B7280]">
                      <span>Заведение: <b className="text-[#0F1115]">{offer.venue.name}</b></span>
                      <span>Баллы: <b className="text-[#015634]">+{offer.pointsReward}</b></span>
                      <span>Использований: <b className="text-[#0F1115]">{offer.usageCount}{offer.usageLimit !== null ? ` / ${offer.usageLimit}` : ""}</b></span>
                      <span>Создан: <b className="text-[#0F1115]">{new Date(offer.createdAt).toLocaleDateString("ru-RU")}</b></span>
                      {offer.startsAt && <span>С: <b className="text-[#0F1115]">{new Date(offer.startsAt).toLocaleDateString("ru-RU")}</b></span>}
                      {offer.endsAt   && <span>До: <b className="text-[#0F1115]">{new Date(offer.endsAt).toLocaleDateString("ru-RU")}</b></span>}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <a
                        href={qrSrc(offer.qrToken)}
                        download={`ayoo-promo-${offer.id}.png`}
                        className="px-3 py-1.5 bg-[#0F1115] text-white text-xs font-semibold rounded-lg hover:bg-[#1F2937] transition-colors"
                      >
                        ↓ Скачать QR
                      </a>
                      {offer.active && (
                        <button
                          onClick={() => {
                            if (confirm("Деактивировать акцию?")) {
                              deactivateMutation.mutate({ offerId: offer.id })
                            }
                          }}
                          className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Деактивировать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#6B7280] mb-1.5">{children}</label>
}

const input = "w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#0F1115] focus:outline-none focus:border-[#0F1115] transition-colors bg-white"
