export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar — expanded in Tier 1 step 4 */}
      <aside className="w-64 bg-white border-r border-[#E5E7EB] flex flex-col">
        <div className="px-6 py-5 border-b border-[#E5E7EB]">
          <span className="text-lg font-bold text-[#0F1115] font-display">ayoo</span>
          <span className="ml-2 text-xs text-[#6B7280] font-medium uppercase tracking-wide">Merchant</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/dashboard/analytics", label: "Analytics" },
            { href: "/dashboard/purchase", label: "New Purchase" },
            { href: "/dashboard/redeem", label: "Redeem Reward" },
            { href: "/dashboard/rewards", label: "Rewards" },
            { href: "/dashboard/checkins", label: "Check-ins" },
            { href: "/dashboard/transactions", label: "Transactions" },
            { href: "/dashboard/imports", label: "Venue imports" },
            { href: "/dashboard/settings", label: "Settings" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center px-3 py-2 text-sm rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#0F1115] transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
