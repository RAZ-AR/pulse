"use client"

import { useState, useEffect } from "react"
import { trpc } from "../../../../src/lib/trpc"

export default function SettingsPage() {
  const { data: dash, refetch } = trpc.merchant.dashboard.useQuery()
  const venue = dash?.venues[0]

  // Rate settings
  const [rate, setRate] = useState("")
  const [boostMultiplier, setBoostMultiplier] = useState("")
  const [boostDays, setBoostDays] = useState("")
  const [rateMsg, setRateMsg] = useState("")

  // Venue info
  const [venueName, setVenueName] = useState("")
  const [venueAddress, setVenueAddress] = useState("")
  const [venueMsg, setVenueMsg] = useState("")

  useEffect(() => {
    if (!venue) return
    setRate(venue.pointsPerCurrency?.toString() ?? "")
    setVenueName(venue.name)
  }, [venue])

  const updateRate = trpc.merchant.updateRate.useMutation({
    onSuccess: () => { setRateMsg("Saved"); refetch(); setTimeout(() => setRateMsg(""), 2000) },
    onError: (e) => setRateMsg(e.message),
  })

  const updateVenue = trpc.merchant.updateVenue.useMutation({
    onSuccess: () => { setVenueMsg("Saved"); refetch(); setTimeout(() => setVenueMsg(""), 2000) },
    onError: (e) => setVenueMsg(e.message),
  })

  function handleRateSave() {
    if (!venue) return
    const pts = parseFloat(rate)
    if (isNaN(pts) || pts <= 0) { setRateMsg("Enter a valid rate"); return }

    const multiplier = boostMultiplier ? parseFloat(boostMultiplier) : undefined
    const days = boostDays ? parseInt(boostDays) : undefined
    const boostUntil = days ? new Date(Date.now() + days * 86_400_000) : undefined

    updateRate.mutate({
      venueId: venue.id,
      pointsPerCurrency: pts,
      currency: "RSD",
      ...(multiplier !== undefined && { boostMultiplier: multiplier }),
      ...(boostUntil !== undefined && { boostUntil }),
    })
  }

  function handleVenueSave() {
    if (!venue) return
    updateVenue.mutate({
      venueId: venue.id,
      ...(venueName.trim() && venueName !== venue.name && { name: venueName.trim() }),
      ...(venueAddress.trim() && { address: venueAddress.trim() }),
    })
  }

  const boostActive = venue?.boostUntil && new Date(venue.boostUntil) > new Date()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">Venue configuration and points rate</p>
      </div>

      {/* Points rate */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
        <h2 className="text-base font-semibold text-[#0F1115] mb-1">Points rate</h2>
        <p className="text-xs text-[#6B7280] mb-4">
          How many points per 1 RSD spent. Higher rate = better rank on the leaderboard.
        </p>

        {boostActive && (
          <div className="mb-4 px-3 py-2 bg-[#FEF3C7] rounded-lg text-xs text-[#92400E]">
            Boost active: ×{venue?.boostMultiplier} until {new Date(venue!.boostUntil!).toLocaleDateString()}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">pts per RSD</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.008"
              step="0.001"
              min="0"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
            <p className="text-xs text-[#9CA3AF] mt-1">
              {rate ? `1000 RSD → ${Math.floor(1000 * parseFloat(rate) || 0)} pts` : ""}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Temporary boost ×</label>
            <input
              type="number"
              value={boostMultiplier}
              onChange={(e) => setBoostMultiplier(e.target.value)}
              placeholder="e.g. 2"
              min="1"
              max="10"
              step="0.5"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Boost for (days)</label>
            <input
              type="number"
              value={boostDays}
              onChange={(e) => setBoostDays(e.target.value)}
              placeholder="e.g. 7"
              min="1"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleRateSave}
            disabled={updateRate.isPending}
            className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50"
          >
            {updateRate.isPending ? "Saving…" : "Save rate"}
          </button>
          {rateMsg && (
            <span className={`text-sm ${rateMsg === "Saved" ? "text-[#059669]" : "text-red-600"}`}>
              {rateMsg}
            </span>
          )}
        </div>
      </section>

      {/* Venue info */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-base font-semibold text-[#0F1115] mb-4">Venue info</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Venue name</label>
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Address</label>
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Street, city"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleVenueSave}
            disabled={updateVenue.isPending}
            className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50"
          >
            {updateVenue.isPending ? "Saving…" : "Save"}
          </button>
          {venueMsg && (
            <span className={`text-sm ${venueMsg === "Saved" ? "text-[#059669]" : "text-red-600"}`}>
              {venueMsg}
            </span>
          )}
        </div>
      </section>
    </div>
  )
}
