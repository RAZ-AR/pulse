"use client"

import { useEffect, useRef, useState } from "react"

export type PickedPlace = { address: string; city: string; lat: number; lng: number }

type Prediction = {
  mainText: string
  secondaryText: string
  description: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

/**
 * Address field with free OSM (Photon) autocomplete. Typing queries
 * /api/places/autocomplete; picking a suggestion hands back the address plus
 * its coordinates + city via onPick, so the venue actually lands on the map.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onPick,
  cityHint = "",
  placeholder = "Start typing an address…",
}: {
  value: string
  onChange: (text: string) => void
  onPick: (place: PickedPlace) => void
  cityHint?: string
  placeholder?: string
}) {
  const [items, setItems] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const skipNext = useRef(false)

  // Debounced lookup as the merchant types.
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return }
    const q = value.trim()
    if (q.length < 2) { setItems([]); setOpen(false); return }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const url = `/api/places/autocomplete?input=${encodeURIComponent(q)}${cityHint ? `&city=${encodeURIComponent(cityHint)}` : ""}`
        const res = await fetch(url, { signal: ctrl.signal })
        const data = (await res.json()) as { predictions?: Prediction[] }
        setItems(data.predictions ?? [])
        setOpen(true)
      } catch {
        // aborted or network — ignore
      } finally {
        setLoading(false)
      }
    }, 450)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [value, cityHint])

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const pick = (p: Prediction) => {
    skipNext.current = true
    onChange(p.mainText)
    setOpen(false)
    setItems([])
    if (p.lat != null && p.lng != null) {
      onPick({ address: p.mainText, city: p.secondaryText || cityHint, lat: p.lat, lng: p.lng })
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (items.length) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-[#9CA3AF]">…</span>
      )}
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-64 overflow-auto">
          {items.map((p, i) => (
            <li key={`${p.description}-${i}`}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] border-b border-[#F3F4F6] last:border-0"
              >
                <div className="text-sm text-[#0F1115]">{p.mainText}</div>
                {p.secondaryText ? (
                  <div className="text-xs text-[#6B7280]">{p.secondaryText}</div>
                ) : null}
                {p.lat == null && (
                  <div className="text-[10px] text-[#B45309]">координаты появятся после выбора на карте</div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
