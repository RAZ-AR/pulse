"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { VenueProvider, useVenue } from "../../src/context/venue-context"

const NAV = [
  { href: "/dashboard",              label: "Дашборд",    icon: "▣" },
  { href: "/dashboard/analytics",    label: "Аналитика",  icon: "↗" },
  { href: "/dashboard/purchase",     label: "Покупка",    icon: "＋" },
  { href: "/dashboard/promos",       label: "Promo QR",   icon: "⬛" },
  { href: "/dashboard/redeem",       label: "Погашение",  icon: "✓" },
  { href: "/dashboard/rewards",      label: "Награды",    icon: "★" },
  { href: "/dashboard/checkins",     label: "Чек-ины",    icon: "📍" },
  { href: "/dashboard/transactions", label: "Транзакции", icon: "↕" },
  { href: "/dashboard/settings",     label: "Настройки",  icon: "⚙" },
]

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { venues, venueId, setVenueId, venue, loading } = useVenue()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="ayoo" className="h-7 w-auto" />
          <span className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">Merchant</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#0F1115] text-2xl leading-none">×</button>
        )}
      </div>

      {/* Venue block */}
      <div className="px-4 py-4 border-b border-[#E5E7EB]">
        {loading ? (
          <div className="h-9 rounded-lg bg-[#F3F4F6] animate-pulse" />
        ) : venues.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">Заведения не найдены</p>
        ) : venues.length === 1 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9FAFB]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
            <span className="text-sm font-medium text-[#0F1115] truncate">{venue?.name}</span>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1.5 px-1">Заведение</p>
            <select
              value={venueId}
              onChange={e => setVenueId(e.target.value)}
              className="w-full text-sm font-medium text-[#0F1115] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0F1115]"
            >
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
        {venue && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${venue.isPartner ? "bg-[#d1fae5] text-[#065f46]" : "bg-[#fef3c7] text-[#92400e]"}`}>
              {venue.isPartner ? "Партнёр" : "Базовый"}
            </span>
            {venue.pointsPerCurrency && (
              <span className="text-[10px] text-[#6B7280]">{venue.pointsPerCurrency} pts/{venue.currency ?? "₽"}</span>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              {...(onClose ? { onClick: onClose } : {})}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "bg-[#0F1115] text-white font-medium" : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#0F1115]"
              }`}
            >
              <span className="w-5 text-center">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-4 py-3 border-t border-[#E5E7EB]">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/signout" className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-[#ef4444] transition-colors">
          <span>⎋</span> Выйти
        </a>
      </div>
    </div>
  )
}

function VenueTitle() {
  const { venue } = useVenue()
  if (!venue) return null
  return <span className="text-sm font-medium text-[#6B7280]">{venue.name}</span>
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-[#E5E7EB] fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-200 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar onClose={() => setOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:ml-60 min-h-screen">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E5E7EB]">
          <button onClick={() => setOpen(true)} className="p-2 -ml-1 rounded-lg text-[#6B7280] hover:bg-[#F9FAFB]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/logo.svg" alt="ayoo" className="h-6 w-auto" />
          <VenueTitle />
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <VenueProvider>
      <Shell>{children}</Shell>
    </VenueProvider>
  )
}
