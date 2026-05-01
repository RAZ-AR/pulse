"use client"

import { trpc } from "../../../../src/lib/trpc"

const TYPE_LABELS: Record<string, string> = {
  PARTNER_PURCHASE: "Purchase",
  RECEIPT_SCAN: "Receipt scan",
  CHECKIN_PHOTO: "Check-in",
  REFERRAL: "Referral",
  BONUS: "Streak bonus",
  REWARD_REDEEMED: "Reward redeemed",
  GIFT_SENT: "Gift sent",
  GIFT_RECEIVED: "Gift received",
  CHALLENGE_COMPLETE: "Challenge",
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

export default function TransactionsPage() {
  const { data: dash } = trpc.merchant.dashboard.useQuery()
  const venueId = dash?.venues[0]?.id ?? ""

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.merchant.transactions.useInfiniteQuery(
      { venueId, limit: 30 },
      {
        enabled: !!venueId,
        getNextPageParam: (last) => last.nextCursor,
        initialCursor: undefined,
      }
    )

  const transactions = data?.pages.flatMap((p) => p.transactions) ?? []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">Transactions</h1>
        <p className="text-sm text-[#6B7280] mt-1">All point awards at your venue</p>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-sm text-[#9CA3AF]">No transactions yet.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-xs font-bold text-[#6B7280]">
                    {tx.type === "PARTNER_PURCHASE" ? "₽" : tx.type === "REWARD_REDEEMED" ? "★" : "○"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0F1115]">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">{formatDate(tx.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${tx.pointsEarned > 0 ? "text-[#059669]" : "text-[#6B7280]"}`}>
                    {tx.pointsEarned > 0 ? `+${tx.pointsEarned}` : tx.pointsEarned} pts
                  </p>
                  {tx.amount && (
                    <p className="text-xs text-[#9CA3AF]">{tx.amount.toLocaleString()} {tx.currency}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-4 w-full py-2 border border-[#D1D5DB] text-sm text-[#374151] rounded-xl hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
