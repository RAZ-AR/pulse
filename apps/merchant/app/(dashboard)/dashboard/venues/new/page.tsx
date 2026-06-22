"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "../../../../../src/lib/trpc"
import { useVenue } from "../../../../../src/context/venue-context"
import { AddressAutocomplete, type PickedPlace } from "../../../../../src/components/AddressAutocomplete"

const CATEGORIES = [
  { key: "CAFE", label: "Кафе" },
  { key: "RESTAURANT", label: "Ресторан" },
  { key: "RETAIL", label: "Магазин" },
  { key: "SERVICE", label: "Услуги" },
  { key: "OTHER", label: "Другое" },
] as const

type Category = (typeof CATEGORIES)[number]["key"]

export default function NewVenuePage() {
  const router = useRouter()
  const { setVenueId } = useVenue()
  const { refetch } = trpc.merchant.dashboard.useQuery()

  const [name, setName] = useState("")
  const [category, setCategory] = useState<Category>("CAFE")
  const [address, setAddress] = useState("")
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [rate, setRate] = useState("")
  const [err, setErr] = useState("")

  const create = trpc.merchant.createVenue.useMutation({
    onSuccess: async (venue) => {
      await refetch()
      setVenueId(venue.id)
      router.push("/dashboard/settings")
    },
    onError: (e) => setErr(e.message),
  })

  const ready = name.trim().length > 0 && place != null && place.address === address.trim()

  function handleCreate() {
    setErr("")
    if (!name.trim()) { setErr("Введите название"); return }
    if (!place) { setErr("Выберите адрес из списка — нужны координаты"); return }
    const pts = rate ? parseFloat(rate) : undefined
    if (rate && (isNaN(pts!) || pts! <= 0)) { setErr("Некорректный курс баллов"); return }
    create.mutate({
      name: name.trim(),
      category,
      address: place.address,
      city: place.city || "Belgrade",
      lat: place.lat,
      lng: place.lng,
      ...(pts !== undefined ? { pointsPerCurrency: pts } : {}),
    })
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-sm text-[#6B7280] hover:text-[#0F1115] mb-3">← Назад</button>
        <h1 className="text-2xl font-bold text-[#0F1115]">Новое заведение</h1>
        <p className="text-sm text-[#6B7280] mt-1">Найдите адрес — координаты подставятся автоматически.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Café Willow"
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
          >
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Адрес</label>
          <AddressAutocomplete
            value={address}
            onChange={(t) => { setAddress(t); setPlace(null) }}
            onPick={(p) => { setAddress(p.address); setPlace(p) }}
            placeholder="Начните вводить адрес…"
          />
          {place && place.address === address.trim() ? (
            <p className="mt-1 text-xs text-[#059669]">📍 {place.city || "—"} · {place.lat.toFixed(5)}, {place.lng.toFixed(5)}</p>
          ) : address.trim() ? (
            <p className="mt-1 text-xs text-[#9CA3AF]">Выберите вариант из списка, чтобы зафиксировать точку</p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Курс баллов <span className="text-[#9CA3AF]">(необязательно)</span></label>
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            inputMode="decimal"
            placeholder="напр. 0.01 (баллов за 1 RSD)"
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleCreate}
            disabled={!ready || create.isPending}
            className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50"
          >
            {create.isPending ? "Создаём…" : "Создать заведение"}
          </button>
          <button onClick={() => router.back()} className="text-sm text-[#6B7280] hover:text-[#0F1115]">Отмена</button>
        </div>
      </div>
    </div>
  )
}
