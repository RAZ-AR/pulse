"use client"

import { useState } from "react"
import { trpc } from "../../../../src/lib/trpc"

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const

export default function AnalyticsPage() {
  const { data: dash } = trpc.merchant.dashboard.useQuery()
  const venueId = dash?.venues[0]?.id ?? ""
  const venueName = dash?.venues[0]?.name

  const [days, setDays] = useState<7 | 30 | 90>(30)
  const { data, isLoading } = trpc.merchant.analytics.useQuery(
    { venueId, days },
    { enabled: !!venueId },
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1115]">Analytics</h1>
          {venueName && <p className="text-sm text-[#6B7280] mt-1">{venueName}</p>}
        </div>
        <div className="flex gap-1 border border-[#E5E7EB] rounded-lg p-1 bg-white">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === r.days
                  ? "bg-[#0F1115] text-white"
                  : "text-[#6B7280] hover:text-[#0F1115]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!data || isLoading ? (
        <div className="text-sm text-[#9CA3AF]">Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Metric
              label="Points issued"
              value={data.daily.reduce((s, d) => s + d.points, 0).toLocaleString()}
            />
            <Metric
              label="Transactions"
              value={data.daily.reduce((s, d) => s + d.transactions, 0).toLocaleString()}
            />
            <Metric
              label="Unique customers"
              value={data.customers.unique.toLocaleString()}
            />
            <Metric
              label="Revenue"
              value={`${data.daily.reduce((s, d) => s + d.revenue, 0).toLocaleString()} RSD`}
            />
          </div>

          {/* Daily points chart */}
          <Card title="Points issued per day" subtitle={`Last ${data.days} days`}>
            <Sparkline values={data.daily.map((d) => d.points)} labels={data.daily.map((d) => d.date)} />
          </Card>

          {/* Hour-of-day heatmap */}
          <Card title="Activity heatmap" subtitle="When customers shop · Day × Hour">
            <Heatmap matrix={data.heatmap} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer segments */}
            <Card title="Customer segments" subtitle={`Based on visits in last ${data.days} days`}>
              <CustomerSegments segments={data.customers} />
            </Card>

            {/* City rank */}
            <Card title="Your rank" subtitle={`${data.cityRank.city} · ${data.cityRank.category.toLowerCase()} category`}>
              <RankCard rank={data.cityRank.rank} peerCount={data.cityRank.peerCount} />
            </Card>
          </div>

          {/* Reward leaderboard */}
          <Card
            title="Reward performance"
            subtitle={`Conversion: ${(data.redemptionConversion.rate * 100).toFixed(0)}% (${data.redemptionConversion.used}/${data.redemptionConversion.total} codes used)`}
          >
            {data.rewards.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No rewards yet</p>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {data.rewards.map((r) => {
                  const max = Math.max(...data.rewards.map((rr) => rr.redeemedCount), 1)
                  const pct = (r.redeemedCount / max) * 100
                  return (
                    <div key={r.id} className="py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${r.isActive ? "text-[#0F1115]" : "text-[#9CA3AF] line-through"}`}>
                            {r.title}
                          </span>
                          <span className="text-xs text-[#9CA3AF]">{r.pointsCost} pts</span>
                        </div>
                        <span className="text-sm font-semibold text-[#0F1115]">{r.redeemedCount}</span>
                      </div>
                      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0F1115] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Components ────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#E5E7EB]">
      <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0F1115]">{value}</p>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[#0F1115]">{title}</h3>
        {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Sparkline({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1)
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {values.map((v, i) => {
          const pct = (v / max) * 100
          return (
            <div
              key={i}
              className="flex-1 bg-[#0F1115] rounded-sm hover:opacity-70 transition-opacity relative group min-h-[2px]"
              style={{ height: `${pct}%` }}
              title={`${labels[i]}: ${v} pts`}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-[#0F1115] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                {v}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-[#9CA3AF]">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function Heatmap({ matrix }: { matrix: number[][] }) {
  const max = Math.max(...matrix.flat(), 1)
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Hour labels */}
        <div className="flex gap-[2px] mb-1 ml-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="w-5 text-center text-[9px] text-[#9CA3AF]">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {matrix.map((row, dow) => (
          <div key={dow} className="flex gap-[2px] mb-[2px] items-center">
            <div className="w-8 text-[10px] text-[#6B7280] font-medium">{DAY_LABELS[dow]}</div>
            <div className="flex gap-[2px]">
              {row.map((v, h) => {
                const intensity = v / max
                return (
                  <div
                    key={h}
                    className="w-5 h-5 rounded-sm"
                    style={{
                      backgroundColor: v === 0 ? "#F3F4F6" : `rgba(15, 17, 21, ${0.15 + intensity * 0.85})`,
                    }}
                    title={`${DAY_LABELS[dow]} ${h}:00 — ${v} txns`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomerSegments({ segments }: { segments: { new: number; returning: number; frequent: number; unique: number } }) {
  const total = segments.unique || 1
  const segs = [
    { label: "New (1 visit)", count: segments.new, color: "#3DBEFF" },
    { label: "Returning (2-4)", count: segments.returning, color: "#1FE3A0" },
    { label: "Frequent (5+)", count: segments.frequent, color: "#FF4D8F" },
  ]
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-[#F3F4F6]">
        {segs.map((s) => {
          const pct = (s.count / total) * 100
          return pct > 0 ? <div key={s.label} style={{ width: `${pct}%`, backgroundColor: s.color }} /> : null
        })}
      </div>
      <div className="space-y-2">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-[#374151]">{s.label}</span>
            </div>
            <span className="text-sm font-medium text-[#0F1115]">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankCard({ rank, peerCount }: { rank: number; peerCount: number }) {
  if (rank === 0 || peerCount === 0) {
    return <p className="text-sm text-[#9CA3AF]">No peer venues to compare against in this category</p>
  }
  const percentile = Math.round((1 - (rank - 1) / peerCount) * 100)
  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <p className="text-5xl font-bold text-[#0F1115]">#{rank}</p>
        <p className="text-xs text-[#6B7280] mt-1">of {peerCount}</p>
      </div>
      <div className="flex-1">
        <p className="text-sm text-[#0F1115] font-medium">
          {percentile >= 80
            ? "Top tier — customers love your rate"
            : percentile >= 50
            ? "Above average — keep pushing"
            : "Below the median — consider boosting"}
        </p>
        <p className="text-xs text-[#6B7280] mt-1">
          You rank in the top {percentile}% by points rate among partner venues in this category.
        </p>
      </div>
    </div>
  )
}
