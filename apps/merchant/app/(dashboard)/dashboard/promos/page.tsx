"use client"

import { useState } from "react"
import { trpc } from "../../../../src/lib/trpc"
import { useVenue } from "../../../../src/context/venue-context"

function qrSrc(token: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(`ayoo://offer/${token}`)}`
}

function Badge({ color, children }: { color: "green"|"orange"|"red"|"gray"; children: React.ReactNode }) {
  const cls = { green:"bg-green-50 text-green-700 border-green-200", orange:"bg-orange-50 text-orange-700 border-orange-200", red:"bg-red-50 text-red-700 border-red-200", gray:"bg-gray-50 text-gray-500 border-gray-200" }
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${cls[color]}`}>{children}</span>
}

function statusBadge(offer: { active: boolean; endsAt: Date|null; usageLimit: number|null; usageCount: number }) {
  const now = new Date()
  if (!offer.active) return <Badge color="gray">Деактивирован</Badge>
  if (offer.endsAt && offer.endsAt < now) return <Badge color="red">Истёк</Badge>
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) return <Badge color="orange">Лимит исчерпан</Badge>
  return <Badge color="green">Активен</Badge>
}

const CARD_COLORS = ["#fd4600", "#015634", "#2563eb", "#7c3aed", "#db2777", "#0f1115"]

const emptyForm = () => ({
  title: "", description: "", points: "100", usageLimit: "",
  cardColor: CARD_COLORS[0], expireDays: "", startsAt: "", endsAt: "",
})

export default function PromosPage() {
  const { venues, loading: venueLoading } = useVenue()
  const { data: promos, refetch } = trpc.offer.mine.useQuery()

  const createMutation     = trpc.offer.create.useMutation({ onSuccess: () => { refetch(); setCreatedTokens([]) } })
  const deactivateMutation = trpc.offer.deactivate.useMutation({ onSuccess: () => refetch() })

  const [form, setForm]               = useState(emptyForm)
  const [selectedVenues, setSelected] = useState<string[]>([])
  const [createdTokens, setCreatedTokens] = useState<{ venue: string; token: string }[]>([])
  const [showForm, setShowForm]       = useState(false)
  const [expandedId, setExpandedId]   = useState<string|null>(null)
  const [creating, setCreating]       = useState(false)

  // Auto-select single venue
  const venueList = venues ?? []
  const allSelected = venueList.length > 0 && selectedVenues.length === venueList.length

  function toggleVenue(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }
  function toggleAll() {
    setSelected(allSelected ? [] : venueList.map(v => v.id))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const points = parseInt(form.points)
    const targets = selectedVenues.length > 0 ? selectedVenues : (venueList[0] ? [venueList[0].id] : [])
    if (!form.title.trim() || isNaN(points) || points < 1 || targets.length === 0) return

    setCreating(true)
    const tokens: { venue: string; token: string }[] = []
    try {
      for (const venueId of targets) {
        const res = await createMutation.mutateAsync({
          venueId,
          title:            form.title.trim(),
          description:      form.description.trim() || undefined,
          cardColor:        form.cardColor || undefined,
          pointsReward:     points,
          pointsExpireDays: form.expireDays ? parseInt(form.expireDays) : undefined,
          startsAt:         form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt:           form.endsAt   ? new Date(form.endsAt).toISOString()   : undefined,
          usageLimit:       form.usageLimit ? parseInt(form.usageLimit) : undefined,
        })
        const venueName = venueList.find(v => v.id === venueId)?.name ?? venueId
        tokens.push({ venue: venueName, token: res.qrToken })
      }
      setCreatedTokens(tokens)
      setForm(emptyForm)
      setSelected([])
      setShowForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка создания промо")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1115]">Promo QR</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">QR-коды для промо-акций · каждый пользователь — 1 раз</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setCreatedTokens([]) }}
          className="px-4 py-2 bg-[#0F1115] text-white text-sm font-semibold rounded-xl hover:bg-[#1F2937] transition-colors"
        >
          {showForm ? "Закрыть" : "+ Новая акция"}
        </button>
      </div>

      {/* Created QRs */}
      {createdTokens.length > 0 && (
        <div className="mb-8 space-y-4">
          {createdTokens.map(({ venue, token }) => (
            <div key={token} className="p-5 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-5">
              <img src={qrSrc(token)} alt="QR" className="w-36 h-36 rounded-lg border border-green-200 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-green-800 font-semibold mb-0.5">✅ Акция создана!</p>
                <p className="text-sm text-green-700 mb-1">Заведение: <b>{venue}</b></p>
                <p className="text-xs text-green-600 mb-3">Распечатай или скачай QR и размести в заведении.</p>
                <a href={qrSrc(token)} download={`ayoo-promo-${token.slice(0,8)}.png`}
                  className="inline-block px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-colors">
                  ↓ Скачать PNG
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 bg-white border border-[#E5E7EB] rounded-2xl p-5">
          <h2 className="text-base font-semibold text-[#0F1115] mb-5">Новая промо-акция</h2>

          {/* Venue selection */}
          {venueLoading ? (
            <div className="h-20 bg-[#F3F4F6] rounded-xl animate-pulse mb-4" />
          ) : venueList.length > 1 ? (
            <div className="mb-4">
              <Label>Заведения <span className="text-[#9CA3AF] font-normal">(выберите одно или несколько)</span></Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#E5E7EB] cursor-pointer hover:bg-[#F9FAFB]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[#0F1115]"
                  />
                  <span className="text-sm font-medium text-[#6B7280]">Все заведения</span>
                </label>
                {venueList.map(v => (
                  <label key={v.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedVenues.includes(v.id) ? "border-[#0F1115] bg-[#F9FAFB]" : "border-[#E5E7EB] hover:bg-[#F9FAFB]"}`}>
                    <input
                      type="checkbox"
                      checked={selectedVenues.includes(v.id)}
                      onChange={() => toggleVenue(v.id)}
                      className="w-4 h-4 accent-[#0F1115]"
                    />
                    <span className="text-sm font-medium text-[#0F1115]">{v.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : venueList.length === 1 ? (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-[#F9FAFB] rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="text-sm font-medium text-[#0F1115]">{venueList[0]?.name}</span>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-[#fef3c7] rounded-lg text-sm text-[#92400e]">
              Сначала добавьте заведение — слева «+ Добавить заведение». Без заведения акцию создать нельзя.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Название акции</Label>
              <input required type="text" placeholder="Напр. «Первый визит — 200 баллов»"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={inp} />
            </div>

            <div className="col-span-2">
              <Label>Описание / что нужно сделать <span className="text-[#9CA3AF] font-normal">(необязательно)</span></Label>
              <input type="text" placeholder="Напр. «Покажи QR на кассе при первом заказе»"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={inp} />
            </div>

            <div className="col-span-2">
              <Label>Цвет карточки</Label>
              <div className="flex items-center gap-2.5">
                {CARD_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, cardColor: c }))}
                    aria-label={c}
                    className={`w-8 h-8 rounded-full transition-transform ${form.cardColor === c ? "ring-2 ring-offset-2 ring-[#0F1115] scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div>
              <Label>Бонусных баллов</Label>
              <input required type="number" min={1} value={form.points}
                onChange={e => setForm(f => ({ ...f, points: e.target.value }))} className={inp} />
            </div>

            <div>
              <Label>Баллы сгорают через (дней, пусто = не сгорают)</Label>
              <input type="number" min={1} placeholder="напр. 90" value={form.expireDays}
                onChange={e => setForm(f => ({ ...f, expireDays: e.target.value }))} className={inp} />
            </div>

            <div className="col-span-2">
              <Label>Макс. использований (пусто = ∞)</Label>
              <input type="number" min={1} placeholder="∞" value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} className={inp} />
            </div>

            <div>
              <Label>Активна с (пусто = сейчас)</Label>
              <input type="datetime-local" value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} className={inp} />
            </div>

            <div>
              <Label>Активна до (пусто = бессрочно)</Label>
              <input type="datetime-local" value={form.endsAt}
                onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} className={inp} />
            </div>

            <div className="col-span-2 flex items-center gap-2 text-sm text-[#6B7280] bg-[#F9FAFB] rounded-xl px-4 py-3">
              <span className="text-green-600 font-bold">✓</span>
              Каждый пользователь может использовать акцию только 1 раз
            </div>

            <div className="col-span-2">
              <button type="submit" disabled={creating || venueList.length === 0}
                className="w-full py-3 bg-[#fd4600] text-white font-bold rounded-xl hover:bg-[#c83700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {creating
                  ? "Создаём…"
                  : venueList.length === 0
                    ? "Сначала добавьте заведение"
                    : selectedVenues.length > 1
                      ? `Создать для ${selectedVenues.length} заведений и получить QR`
                      : "Создать и получить QR"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Promo list */}
      <div className="space-y-3">
        {promos === undefined && <p className="text-sm text-[#6B7280]">Загрузка…</p>}
        {promos?.length === 0 && (
          <div className="text-center py-12 text-sm text-[#9CA3AF]">
            Акций пока нет. Нажми «+ Новая акция» чтобы создать первую.
          </div>
        )}
        {promos?.map(offer => {
          const expanded = expandedId === offer.id
          return (
            <div key={offer.id} className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#F9FAFB] transition-colors" onClick={() => setExpandedId(expanded ? null : offer.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-[#0F1115] truncate">{offer.title}</p>
                    {statusBadge(offer)}
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    <b className="text-[#015634]">+{offer.pointsReward} pts</b>
                    {" · "}{offer.venue.name}
                    {" · "}{offer._count.redemptions} использований{offer.usageLimit !== null && ` / ${offer.usageLimit}`}
                    {offer.endsAt && ` · до ${new Date(offer.endsAt).toLocaleDateString("ru-RU")}`}
                  </p>
                </div>
                <span className="text-[#9CA3AF] text-xs">{expanded ? "▲" : "▼"}</span>
              </div>

              {expanded && (
                <div className="border-t border-[#E5E7EB] px-5 py-5 flex items-start gap-5">
                  <img src={qrSrc(offer.qrToken)} alt="QR" className="w-36 h-36 rounded-xl border border-[#E5E7EB] flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#6B7280]">
                      <span>Заведение: <b className="text-[#0F1115]">{offer.venue.name}</b></span>
                      <span>Баллы: <b className="text-[#015634]">+{offer.pointsReward}</b></span>
                      <span>Использований: <b className="text-[#0F1115]">{offer.usageCount}{offer.usageLimit !== null ? ` / ${offer.usageLimit}` : ""}</b></span>
                      <span>Создан: <b className="text-[#0F1115]">{new Date(offer.createdAt).toLocaleDateString("ru-RU")}</b></span>
                      {offer.startsAt && <span>С: <b className="text-[#0F1115]">{new Date(offer.startsAt).toLocaleDateString("ru-RU")}</b></span>}
                      {offer.endsAt   && <span>До: <b className="text-[#0F1115]">{new Date(offer.endsAt).toLocaleDateString("ru-RU")}</b></span>}
                    </div>
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <a href={qrSrc(offer.qrToken)} download={`ayoo-promo-${offer.id}.png`}
                        className="px-3 py-1.5 bg-[#0F1115] text-white text-xs font-semibold rounded-lg hover:bg-[#1F2937] transition-colors">
                        ↓ Скачать QR
                      </a>
                      {offer.active && (
                        <button onClick={() => { if (confirm("Деактивировать акцию?")) deactivateMutation.mutate({ offerId: offer.id }) }}
                          className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors">
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

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#6B7280] mb-1.5">{children}</label>
}

const inp = "w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#0F1115] focus:outline-none focus:border-[#0F1115] transition-colors bg-white"
