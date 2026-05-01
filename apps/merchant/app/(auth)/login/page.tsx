export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0F1115] font-display">
            PULSE <span className="text-[#6B7280] font-normal text-lg">Merchant</span>
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">Sign in to manage your venue</p>
        </div>

        {/* Auth form — wired up in Tier 1 step 4 */}
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F1115] mb-1">Email</label>
            <input
              type="email"
              placeholder="you@venue.com"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#3DBEFF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F1115] mb-1">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#3DBEFF]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-[#0F1115] text-white rounded-lg text-sm font-medium hover:bg-[#1F2937] transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
