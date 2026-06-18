"use client"

import { trpc } from "../../../src/lib/trpc"
import { useVenue } from "../../../src/context/venue-context"

export default function DashboardPage() {
  const { venue, venueId, venues, loading } = useVenue()

  const { data: stats } = trpc.merchant.stats.useQuery(
    { venueId: venueId },
    { enabled: !!venueId }
  )

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="h-8 w-48 bg-[#F3F4F6] rounded-xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-[#F3F4F6] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (venues.length === 0) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-4xl mb-4">🏪</div>
        <h2 className="text-xl font-bold text-[#0F1115] mb-2">Нет заведений</h2>
        <p className="text-sm text-[#6B7280] max-w-xs">Создайте заведение в разделе «Настройки», чтобы начать работу.</p>
        <a href="/dashboard/settings" className="mt-4 px-5 py-2.5 bg-[#0F1115] text-white text-sm font-semibold rounded-xl hover:bg-[#1F2937] transition-colors">
          Перейти в настройки
        </a>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1115]">Дашборд</h1>
        {venue && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[#6B7280]">{venue.name}</span>
            {venue.isPartner && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] font-semibold">Партнёр</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Баллов сегодня"
          value={stats ? stats.today.pointsIssued.toLocaleString("ru-RU") : "—"}
          sub={stats ? `${stats.today.transactions} транзакций` : undefined}
          accent="#fd4600"
        />
        <MetricCard
          label="Погашено наград"
          value={stats ? stats.allTime.rewardsRedeemed.toLocaleString("ru-RU") : "—"}
          sub="за всё время"
        />
        <MetricCard
          label="Баллов за месяц"
          value={stats ? stats.month.pointsIssued.toLocaleString("ru-RU") : "—"}
          sub={stats ? `${stats.month.transactions} транзакций` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">За неделю</h3>
          <div className="space-y-3">
            <StatRow label="Выдано баллов" value={(stats?.week.pointsIssued ?? 0).toLocaleString("ru-RU")} />
            <StatRow label="Транзакций" value={(stats?.week.transactions ?? 0).toLocaleString("ru-RU")} />
            <StatRow label="Транзакций всего" value={(stats?.allTime.transactions ?? 0).toLocaleString("ru-RU")} />
            {venue && (
              <StatRow label="Наград в каталоге" value={venue._count.rewards.toLocaleString("ru-RU")} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <h3 className="text-sm font-semibold text-[#0F1115] mb-4">Топ клиентов</h3>
          {!stats || stats.topCustomers.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">Покупок ещё нет</p>
          ) : (
            <ol className="space-y-2.5">
              {stats.topCustomers.map((c, i) => (
                <li key={c.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-xs text-[#9CA3AF] text-right">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-semibold text-[#6B7280]">
                      {(c.name[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="text-sm text-[#0F1115]">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#015634]">+{c.pointsEarned} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <a href="/dashboard/purchase" className="inline-flex items-center px-4 py-2.5 bg-[#0F1115] text-white text-sm font-semibold rounded-xl hover:bg-[#1F2937] transition-colors">
          Новая покупка
        </a>
        <a href="/dashboard/promos" className="inline-flex items-center px-4 py-2.5 bg-[#fd4600] text-white text-sm font-semibold rounded-xl hover:bg-[#c83700] transition-colors">
          Создать QR промо
        </a>
        <a href="/dashboard/analytics" className="inline-flex items-center px-4 py-2.5 border border-[#E5E7EB] text-[#374151] text-sm font-medium rounded-xl hover:bg-[#F9FAFB] transition-colors">
          Аналитика →
        </a>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
      <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent ?? "#0F1115" }}>{value}</p>
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
