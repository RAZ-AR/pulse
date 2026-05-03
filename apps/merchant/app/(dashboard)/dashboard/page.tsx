"use client"

import { trpc } from "../../../src/lib/trpc"

export default function DashboardPage() {
  const { data: dash } = trpc.merchant.dashboard.useQuery()

  const firstVenueId = dash?.venues[0]?.id
  const { data: stats } = trpc.merchant.stats.useQuery(
    { venueId: firstVenueId! },
    { enabled: !!firstVenueId }
  )

  const venue = dash?.venues[0]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F1115]">Dashboard</h2>
        {venue && (
          <p className="text-sm text-[#6B7280] mt-1">{venue.name}</p>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Points issued today"
          value={stats ? stats.today.pointsIssued.toLocaleString() : "—"}
          {...(stats ? { sub: `${stats.today.transactions} transactions` } : {})}
        />
        <MetricCard
          label="Rewards redeemed"
          value={stats ? stats.allTime.rewardsRedeemed.toLocaleString() : "—"}
          sub="all time"
        />
        <MetricCard
          label="Points this month"
          value={stats ? stats.month.pointsIssued.toLocaleString() : "—"}
          {...(stats ? { sub: `${stats.month.transactions} transactions` } : {})}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly summary */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">This week</h3>
          <div className="space-y-2">
            <StatRow label="Points issued" value={(stats?.week.pointsIssued ?? 0).toLocaleString()} />
            <StatRow label="Transactions" value={(stats?.week.transactions ?? 0).toLocaleString()} />
            <StatRow label="All-time transactions" value={(stats?.allTime.transactions ?? 0).toLocaleString()} />
          </div>
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">Top customers</h3>
          {!stats || stats.topCustomers.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No purchase data yet</p>
          ) : (
            <ol className="space-y-2">
              {stats.topCustomers.map((c, i) => (
                <li key={c.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs text-[#9CA3AF] text-right">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-medium text-[#6B7280]">
                      {(c.name[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="text-sm text-[#0F1115]">{c.name}</span>
                  </div>
                  <span className="text-sm font-medium text-[#0F1115]">{c.pointsEarned} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex gap-3 flex-wrap">
        <a href="/dashboard/purchase" className="inline-flex items-center px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors">
          New Purchase
        </a>
        <a href="/dashboard/redeem" className="inline-flex items-center px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB] transition-colors">
          Validate Reward
        </a>
        <a href="/dashboard/analytics" className="inline-flex items-center px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB] transition-colors">
          View Analytics →
        </a>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#E5E7EB]">
      <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0F1115]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-medium text-[#0F1115]">{value}</span>
    </div>
  )
}
