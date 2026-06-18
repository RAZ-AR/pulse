"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { trpc } from "../lib/trpc"

type Venue = {
  id: string
  name: string
  isPartner: boolean
  pointsPerCurrency: number | null
  currency: string | null
  subscriptionTier: string | null
  _count: { transactions: number; rewards: number }
}

type VenueCtx = {
  venues: Venue[]
  venueId: string
  setVenueId: (id: string) => void
  venue: Venue | undefined
  loading: boolean
}

const Ctx = createContext<VenueCtx>({
  venues: [], venueId: "", setVenueId: () => {}, venue: undefined, loading: true,
})

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = trpc.merchant.dashboard.useQuery()
  const venues = (data?.venues ?? []) as Venue[]
  const [venueId, setVenueId] = useState("")

  useEffect(() => {
    if (!venueId && venues.length > 0 && venues[0]) {
      setVenueId(venues[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const resolvedId = venueId || venues[0]?.id || ""
  const venue = venues.find(v => v.id === resolvedId)

  return (
    <Ctx.Provider value={{ venues, venueId: resolvedId, setVenueId, venue, loading: isLoading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useVenue = () => useContext(Ctx)
