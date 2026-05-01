"use client"

import { useState } from "react"
import { trpc } from "../../../../src/lib/trpc"

type NewReward = {
  title: string
  description: string
  pointsCost: string
  stockLimit: string
}

const EMPTY: NewReward = { title: "", description: "", pointsCost: "", stockLimit: "" }

export default function RewardsPage() {
  const { data: dash } = trpc.merchant.dashboard.useQuery()
  const venueId = dash?.venues[0]?.id ?? ""

  const { data: rewardData, refetch } = trpc.reward.list.useQuery(
    { venueId, limit: 50 },
    { enabled: !!venueId }
  )

  const createReward = trpc.merchant.createReward.useMutation({ onSuccess: () => refetch() })
  const updateReward = trpc.merchant.updateReward.useMutation({ onSuccess: () => refetch() })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewReward>(EMPTY)
  const [error, setError] = useState("")

  function handleCreate() {
    setError("")
    const pts = parseInt(form.pointsCost)
    if (!form.title.trim() || isNaN(pts) || pts < 1) {
      setError("Title and valid points cost are required")
      return
    }
    createReward.mutate(
      {
        venueId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        pointsCost: pts,
        stockLimit: form.stockLimit ? parseInt(form.stockLimit) : undefined,
      },
      {
        onSuccess: () => { setForm(EMPTY); setShowForm(false) },
        onError: (e) => setError(e.message),
      }
    )
  }

  const rewards = rewardData?.rewards ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1115]">Rewards</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage rewards customers can redeem</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors"
        >
          + New reward
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-6">
          <h2 className="text-base font-semibold text-[#0F1115] mb-4">New reward</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Free coffee"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Any size, any drink"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Points cost *</label>
              <input
                type="number"
                value={form.pointsCost}
                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                placeholder="100"
                min="1"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Stock limit (optional)</label>
              <input
                type="number"
                value={form.stockLimit}
                onChange={(e) => setForm({ ...form, stockLimit: e.target.value })}
                placeholder="Unlimited"
                min="1"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY); setError("") }}
              className="px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm rounded-xl hover:bg-[#F9FAFB] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createReward.isPending}
              className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50"
            >
              {createReward.isPending ? "Creating…" : "Create reward"}
            </button>
          </div>
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-sm text-[#9CA3AF]">No rewards yet. Create your first reward to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-[#0F1115]">{r.title}</p>
                {r.description && <p className="text-xs text-[#6B7280] mt-0.5">{r.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-medium text-[#059669]">{r.pointsCost} pts</span>
                  {r.stockLimit !== null && (
                    <span className="text-xs text-[#9CA3AF]">
                      {r.redeemedCount}/{r.stockLimit} redeemed
                    </span>
                  )}
                  {r.stockLimit === null && r.redeemedCount > 0 && (
                    <span className="text-xs text-[#9CA3AF]">{r.redeemedCount} redeemed</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => updateReward.mutate({ rewardId: r.id, isActive: !r.isActive })}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  r.isActive
                    ? "bg-[#D1FAE5] text-[#059669] hover:bg-[#A7F3D0]"
                    : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"
                }`}
              >
                {r.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
