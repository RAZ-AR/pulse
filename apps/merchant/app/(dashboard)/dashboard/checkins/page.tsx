"use client"

import Image from "next/image"
import { trpc } from "../../../../src/lib/trpc"

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

export default function CheckinsPage() {
  const { data: dash } = trpc.merchant.dashboard.useQuery()
  const venueId = dash?.venues[0]?.id ?? ""

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.merchant.checkins.useInfiniteQuery(
      { venueId, limit: 30 },
      {
        enabled: !!venueId,
        getNextPageParam: (last) => last.nextCursor,
        initialCursor: undefined,
      }
    )

  const checkins = data?.pages.flatMap((p) => p.checkins) ?? []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">Check-ins</h1>
        <p className="text-sm text-[#6B7280] mt-1">Photos from guests who checked in at your venue</p>
      </div>

      {checkins.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-sm text-[#9CA3AF]">No check-ins yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {checkins.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="relative aspect-square bg-[#F3F4F6]">
                  <Image
                    src={c.photoUrl}
                    alt="Check-in photo"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-[#0F1115] truncate">
                    {c.user.name ?? c.user.email}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(c.createdAt)}</p>
                  <p className="text-xs text-[#059669] mt-1 font-semibold">+{c.pointsEarned} pts</p>
                </div>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-6 w-full py-2 border border-[#D1D5DB] text-sm text-[#374151] rounded-xl hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  )
}
