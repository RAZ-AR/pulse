"use client"

import { trpc } from "../../../src/lib/trpc"
import { useVenue } from "../../../src/context/venue-context"

export default function DashboardPage() {
  const { venue, venueId, loading: venueLoading } = useVenue()

  const { data: stats, isLoading: statsLoading } = trpc.merchant.stats.useQuery(
    { venueId: venueId! },
    { enabled: !!venueId }
  )

  if (venueLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-[#F3F4F6] rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-[#F3F4F6] rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1115]">{venue ? venue.name : "Дашборд"}</h1>
        {venue && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${venue.isPartner ? "bg-[#d1fae5] text-[#065f46]" : "bg-[#fef3c7] text-[#92400e]"}`}>
              {venue.isPartner ? "Партнёр" : "Базовый"}
            </span>
            {venue.pointsPerCurrency && (
              <span className="text-xs text-[#6B7280]">{venue.pointsPerCurrency} pts / {venue.currency ?? "₽"}</span>
            )}
            <span className="text-xs text-[#9CA3AF]">·</span>
            <span className="text-xs text-[#6B7280]">{venue._count.transactions} транзакций · {venue._count.rewards} наград</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Баллов сегодня"  value={statsLoading ? null : (stats?.today.pointsIssued ?? 0)}  color="green"  {...(stats ? { sub: `${stats.today.transactions} транзакций` } : {})} />
        <StatCard label="Баллов за месяц" value={statsLoading ? null : (stats?.month.pointsIssued ?? 0)}  color="blue"   {...(stats ? { sub: `${stats.month.transactions} транзакций` } : {})} />
        <StatCard label="Наград погашено" value={statsLoading ? null : (stats?.allTime.rewardsRedeemed ?? 0)} color="orange" sub="за всё время" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">За неделю</h3>
          <div className="space-y-3">
            <StatRow label="Баллов выдано"    value={statsLoading ? "…" : (stats?.week.pointsIssued ?? 0).toLocaleString()} />
            <StatRow label="Транзакций"        value={statsLoading ? "…" : (stats?.week.transactions ?? 0).toLocaleString()} />
            <StatRow label="Всего транзакций"  value={statsLoading ? "…" : (stats?.allTime.transactions ?? 0).toLocaleString()} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">Топ клиентов</h3>
          {!stats || stats.topCustomers.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">Данных пока нет</p>
          ) : (
            <ol className="space-y-2.5">
              {stats.topCustomers.map((c, i) => (
                <li key={c.userId} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-[#9CA3AF] text-right shrink-0">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-medium text-[#6B7280] shrink-0">
                    {(c.name[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="text-sm text-[#0F1115] flex-1 truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-[#015634] shrink-0">+{c.pointsEarned} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/dashboard/purchase" className="px-4 py-2 bg-[#0F1115] text-white text-sm font-medium rounded-xl hover:bg-[#1f2228] transition-colors">+ Новая покупка</a>
        <a href="/dashboard/promos"   className="px-4 py-2 bg-[#fd4600] text-white text-sm font-medium rounded-xl hover:bg-[#c83700] transition-colors">⬛ Promo QR</a>
        <a href="/dashboard/redeem"   className="px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB] transition-colors">✓ Погасить</a>
        <a href="/dashboard/analytics" className="px-4 py-2 border border-[#D1D5DB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB] transition-colors">↗ Аналитика</a>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | null; sub?: string; color: "green"|"blue"|"orange" }) {
  const cls = { green: "text-[#16a34a]", blue: "text-[#2563eb]", orange: "text-[#ea580c]" }
  return (
    <div className="bg-white rounded-xl p-5 border border-[#E5E7EB]">
      <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${cls[color]}`}>{value === null ? <span className="text-[#D1D5DB]">—</span> : value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-semibold text-[#0F1115]">{value}</span>
    </div>
  )
}
