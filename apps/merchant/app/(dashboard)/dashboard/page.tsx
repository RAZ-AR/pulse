export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0F1115] font-display">Dashboard</h2>
        <p className="text-sm text-[#6B7280] mt-1">Manage your venue&apos;s loyalty program</p>
      </div>

      {/* Metric cards — wired to real data in Tier 2 step 12 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Points issued today", value: "—" },
          { label: "Rewards redeemed", value: "—" },
          { label: "Active members", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-[#E5E7EB]">
            <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-3xl font-bold text-[#0F1115] font-display">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <p className="text-sm text-[#6B7280]">
          Full dashboard analytics coming in Tier 2. Set up your venue, rewards, and points rate to get started.
        </p>
      </div>
    </div>
  )
}
