"use client"

import { useState, useTransition } from "react"
import { trpc } from "../../../../src/lib/trpc"

type Step = "lookup" | "amount" | "confirm" | "success"

interface FoundUser {
  id: string
  name: string | null
  totalPoints: number
  currentStreak: number
}

interface PurchaseResult {
  transactionId: string
  pointsEarned: number
  streakBonus: number
  newStreak: number
  newTotalPoints: number
}

// ── Venue selector ────────────────────────────────────────────

function VenueSelector({
  onSelect,
}: {
  onSelect: (venueId: string, venueName: string) => void
}) {
  const { data } = trpc.merchant.myVenues.useQuery()
  const venues = data ?? []

  if (venues.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-[#9CA3AF]">
        No venues found. Set up a venue in Settings first.
      </div>
    )
  }

  if (venues.length === 1 && venues[0]) {
    const v = venues[0]
    onSelect(v.id, v.name)
    return null
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Select venue</h2>
      <p className="text-sm text-[#6B7280] mb-6">Which venue are you operating at?</p>
      <div className="space-y-2">
        {venues.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id, v.name)}
            className="w-full text-left px-4 py-3 border border-[#D1D5DB] rounded-xl hover:border-[#0F1115] hover:bg-[#F9FAFB] transition-colors"
          >
            <p className="text-sm font-medium text-[#0F1115]">{v.name}</p>
            {v.pointsPerCurrency && (
              <p className="text-xs text-[#6B7280] mt-0.5">
                {v.pointsPerCurrency} pts/RSD
                {v.boostUntil && new Date(v.boostUntil) > new Date() && ` · ×${v.boostMultiplier} boost active`}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Step 1: User lookup ───────────────────────────────────────

function LookupStep({ onFound }: { onFound: (user: FoundUser) => void }) {
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const utils = trpc.useUtils()

  async function handleLookup() {
    setError("")
    const val = input.trim().toUpperCase()
    if (!val) return
    try {
      const isCode = /^[A-Z0-9]{6}$/.test(val)
      const user = await utils.user.lookupForMerchant.fetch(
        isCode ? { referralCode: val } : { userId: val }
      )
      onFound(user)
    } catch {
      setError("User not found. Check the QR code or referral code.")
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Find customer</h2>
      <p className="text-sm text-[#6B7280] mb-6">Scan QR or enter 6-character referral code</p>
      <label className="block text-sm font-medium text-[#374151] mb-1">QR / Referral code</label>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        placeholder="e.g. AB12CD"
        maxLength={64}
        autoFocus
        className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115] uppercase tracking-widest"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleLookup}
        className="mt-4 w-full bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors"
      >
        Look up
      </button>
    </div>
  )
}

// ── Step 2: Enter amount ──────────────────────────────────────

function AmountStep({ user, onNext, onBack }: { user: FoundUser; onNext: (n: number) => void; onBack: () => void }) {
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")

  function handleNext() {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) { setError("Enter a valid positive amount"); return }
    onNext(n)
  }

  return (
    <div>
      <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#0F1115] flex items-center justify-center text-white text-sm font-bold">
          {(user.name ?? "?")[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-[#0F1115] text-sm">{user.name ?? "Unknown"}</p>
          <p className="text-xs text-[#6B7280]">{user.totalPoints} pts · {user.currentStreak} day streak</p>
        </div>
      </div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Purchase amount</h2>
      <p className="text-sm text-[#6B7280] mb-6">Total amount the customer is paying</p>
      <label className="block text-sm font-medium text-[#374151] mb-1">Amount (RSD)</label>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleNext()}
        placeholder="0.00"
        min="0"
        step="0.01"
        autoFocus
        className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button onClick={onBack} className="flex-1 border border-[#D1D5DB] text-[#374151] text-sm font-medium py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors">Back</button>
        <button onClick={handleNext} className="flex-1 bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors">Continue</button>
      </div>
    </div>
  )
}

// ── Step 3: Confirm ───────────────────────────────────────────

function ConfirmStep({ user, amount, venueId, venueName, onSuccess, onBack }: {
  user: FoundUser; amount: number; venueId: string; venueName: string
  onSuccess: (r: PurchaseResult) => void; onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const mutation = trpc.transaction.partnerPurchase.useMutation()

  function handleConfirm() {
    setError("")
    startTransition(() => {
      mutation.mutate(
        { userId: user.id, venueId, amount, currency: "RSD" },
        { onSuccess: (d) => onSuccess(d), onError: (e) => setError(e.message) }
      )
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-6">Confirm purchase</h2>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
        <Row label="Customer" value={user.name ?? "—"} />
        <Row label="Venue" value={venueName} />
        <Row label="Amount" value={`${amount.toLocaleString()} RSD`} />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onBack} disabled={isPending || mutation.isPending} className="flex-1 border border-[#D1D5DB] text-[#374151] text-sm font-medium py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors disabled:opacity-50">Back</button>
        <button onClick={handleConfirm} disabled={isPending || mutation.isPending} className="flex-1 bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50">
          {mutation.isPending ? "Processing…" : "Confirm"}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-3">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-[#059669]" : "text-[#0F1115]"}`}>{value}</span>
    </div>
  )
}

// ── Step 4: Success ───────────────────────────────────────────

function SuccessStep({ result, user, onNewPurchase }: { result: PurchaseResult; user: FoundUser; onNewPurchase: () => void }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Points awarded!</h2>
      <p className="text-sm text-[#6B7280] mb-6">{user.name} earned points for this purchase</p>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] text-left mb-6">
        <Row label="Points earned" value={`+${result.pointsEarned}`} highlight />
        {result.streakBonus > 0 && <Row label="Streak bonus" value={`+${result.streakBonus}`} highlight />}
        <Row label="New streak" value={`${result.newStreak} days`} />
        <Row label="Total balance" value={`${result.newTotalPoints} pts`} />
      </div>
      <button onClick={onNewPurchase} className="w-full bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors">
        New purchase
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function PurchasePage() {
  const [venueId, setVenueId] = useState<string | null>(null)
  const [venueName, setVenueName] = useState("")
  const [step, setStep] = useState<Step>("lookup")
  const [user, setUser] = useState<FoundUser | null>(null)
  const [amount, setAmount] = useState(0)
  const [result, setResult] = useState<PurchaseResult | null>(null)

  function reset() {
    setStep("lookup"); setUser(null); setAmount(0); setResult(null)
  }

  const steps: Step[] = ["lookup", "amount", "confirm", "success"]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">New Purchase</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {venueName ? `Venue: ${venueName}` : "Award loyalty points to a customer"}
        </p>
      </div>

      {venueId && (
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? "bg-[#0F1115] text-white"
                  : steps.indexOf(step) > i ? "bg-[#D1FAE5] text-[#059669]"
                  : "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}>{i + 1}</div>
              {i < 3 && <div className="w-8 h-px bg-[#E5E7EB]" />}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 max-w-md">
        {!venueId ? (
          <VenueSelector onSelect={(id, name) => { setVenueId(id); setVenueName(name) }} />
        ) : step === "lookup" ? (
          <LookupStep onFound={(u) => { setUser(u); setStep("amount") }} />
        ) : step === "amount" && user ? (
          <AmountStep user={user} onNext={(a) => { setAmount(a); setStep("confirm") }} onBack={() => setStep("lookup")} />
        ) : step === "confirm" && user ? (
          <ConfirmStep user={user} amount={amount} venueId={venueId} venueName={venueName}
            onSuccess={(r) => { setResult(r); setStep("success") }} onBack={() => setStep("amount")} />
        ) : step === "success" && user && result ? (
          <SuccessStep result={result} user={user} onNewPurchase={reset} />
        ) : null}
      </div>
    </div>
  )
}
