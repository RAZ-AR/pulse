"use client"

import { useState, useTransition } from "react"
import { trpc } from "../../../../src/lib/trpc"

type Mode = "award" | "spend"
type Step =
  | "lookup"
  | "amount" | "confirm" | "success"
  | "spend-amount" | "spend-confirm" | "spend-success"

interface FoundUser {
  id: string
  name: string | null
  earnedPoints: number
  totalPoints: number
  currentStreak: number
}

interface AwardResult {
  transactionId: string
  pointsEarned: number
  streakBonus: number
  newStreak: number
  newTotalPoints: number
}

interface SpendResult {
  pointsSpent: number
  newEarnedPoints: number
}

// ── Venue selector ────────────────────────────────────────────

function VenueSelector({ onSelect }: { onSelect: (id: string, name: string) => void }) {
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
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Выберите заведение</h2>
      <div className="space-y-2 mt-4">
        {venues.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id, v.name)}
            className="w-full text-left px-4 py-3 border border-[#D1D5DB] rounded-xl hover:border-[#0F1115] hover:bg-[#F9FAFB] transition-colors"
          >
            <p className="text-sm font-medium text-[#0F1115]">{v.name}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Mode selector ─────────────────────────────────────────────

function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Что нужно сделать?</h2>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          onClick={() => onSelect("award")}
          className="flex flex-col items-center gap-2 p-5 border-2 border-[#E5E7EB] rounded-2xl hover:border-[#0F1115] hover:bg-[#F9FAFB] transition-colors text-center"
        >
          <span className="text-2xl">➕</span>
          <span className="text-sm font-semibold text-[#0F1115]">Начислить баллы</span>
          <span className="text-xs text-[#6B7280]">Клиент совершил покупку</span>
        </button>
        <button
          onClick={() => onSelect("spend")}
          className="flex flex-col items-center gap-2 p-5 border-2 border-[#E5E7EB] rounded-2xl hover:border-[#fd4600] hover:bg-[#fff8f6] hover:border-[#fd4600] transition-colors text-center"
        >
          <span className="text-2xl">💳</span>
          <span className="text-sm font-semibold text-[#0F1115]">Принять баллы</span>
          <span className="text-xs text-[#6B7280]">Клиент платит баллами</span>
        </button>
      </div>
    </div>
  )
}

// ── Lookup step ───────────────────────────────────────────────

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
      setError("Пользователь не найден. Проверьте QR-код или реферальный код.")
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Найти клиента</h2>
      <p className="text-sm text-[#6B7280] mb-6">Отсканируйте QR или введите 6-символьный код</p>
      <label className="block text-sm font-medium text-[#374151] mb-1">QR / Реферальный код</label>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        placeholder="AB12CD"
        maxLength={64}
        autoFocus
        className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F1115] uppercase tracking-widest"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleLookup}
        className="mt-4 w-full bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors"
      >
        Найти
      </button>
    </div>
  )
}

// ── Award: amount step ────────────────────────────────────────

function AmountStep({ user, onNext, onBack }: { user: FoundUser; onNext: (n: number) => void; onBack: () => void }) {
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")

  function handleNext() {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) { setError("Введите корректную сумму"); return }
    onNext(n)
  }

  return (
    <div>
      <UserCard user={user} />
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Сумма покупки</h2>
      <p className="text-sm text-[#6B7280] mb-6">Сумма, которую клиент оплачивает</p>
      <label className="block text-sm font-medium text-[#374151] mb-1">Сумма (RSD)</label>
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
        <button onClick={onBack} className={btnSecondary}>Назад</button>
        <button onClick={handleNext} className={btnPrimary}>Далее</button>
      </div>
    </div>
  )
}

// ── Award: confirm step ───────────────────────────────────────

function ConfirmStep({ user, amount, venueId, venueName, onSuccess, onBack }: {
  user: FoundUser; amount: number; venueId: string; venueName: string
  onSuccess: (r: AwardResult) => void; onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [idempotencyKey] = useState(() => {
    const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
    return `purchase:${venueId}:${user.id}:${random}`
  })
  const [error, setError] = useState("")
  const mutation = trpc.transaction.partnerPurchase.useMutation()

  function handleConfirm() {
    setError("")
    startTransition(() => {
      mutation.mutate(
        { userId: user.id, venueId, amount, currency: "RSD", idempotencyKey },
        { onSuccess: (d) => onSuccess(d), onError: (e) => setError(e.message) }
      )
    })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-6">Подтвердить покупку</h2>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
        <Row label="Клиент" value={user.name ?? "—"} />
        <Row label="Заведение" value={venueName} />
        <Row label="Сумма" value={`${amount.toLocaleString()} RSD`} />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onBack} disabled={isPending || mutation.isPending} className={btnSecondary + " disabled:opacity-50"}>Назад</button>
        <button onClick={handleConfirm} disabled={isPending || mutation.isPending} className={btnPrimary + " disabled:opacity-50"}>
          {mutation.isPending ? "Обработка…" : "Подтвердить"}
        </button>
      </div>
    </div>
  )
}

// ── Award: success step ───────────────────────────────────────

function SuccessStep({ result, user, onNew }: { result: AwardResult; user: FoundUser; onNew: () => void }) {
  return (
    <div className="text-center">
      <CheckCircle />
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Баллы начислены!</h2>
      <p className="text-sm text-[#6B7280] mb-6">{user.name} получил баллы за покупку</p>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] text-left mb-6">
        <Row label="Начислено" value={`+${result.pointsEarned}`} highlight />
        {result.streakBonus > 0 && <Row label="Бонус стрика" value={`+${result.streakBonus}`} highlight />}
        <Row label="Стрик" value={`${result.newStreak} дней`} />
        <Row label="Баланс" value={`${result.newTotalPoints} pts`} />
      </div>
      <button onClick={onNew} className={btnPrimary}>Новая операция</button>
    </div>
  )
}

// ── Spend: amount step ────────────────────────────────────────

function SpendAmountStep({ user, onNext, onBack }: { user: FoundUser; onNext: (n: number) => void; onBack: () => void }) {
  const [points, setPoints] = useState("")
  const [error, setError] = useState("")

  function handleNext() {
    const n = parseInt(points)
    if (isNaN(n) || n <= 0) { setError("Введите количество баллов"); return }
    if (n > user.earnedPoints) { setError(`Недостаточно баллов. Доступно: ${user.earnedPoints}`); return }
    onNext(n)
  }

  return (
    <div>
      <UserCard user={user} spend />
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Сколько баллов принять?</h2>
      <p className="text-sm text-[#6B7280] mb-6">Клиент оплачивает часть или всю покупку баллами</p>
      <label className="block text-sm font-medium text-[#374151] mb-1">Баллов (макс. {user.earnedPoints})</label>
      <input
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleNext()}
        placeholder="0"
        min="1"
        max={user.earnedPoints}
        autoFocus
        className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fd4600]"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button onClick={onBack} className={btnSecondary}>Назад</button>
        <button onClick={handleNext} className="flex-1 bg-[#fd4600] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#c83700] transition-colors">Далее</button>
      </div>
    </div>
  )
}

// ── Spend: confirm step ───────────────────────────────────────

function SpendConfirmStep({ user, points, venueId, venueName, onSuccess, onBack }: {
  user: FoundUser; points: number; venueId: string; venueName: string
  onSuccess: (r: SpendResult) => void; onBack: () => void
}) {
  const [error, setError] = useState("")
  const mutation = trpc.transaction.spendPoints.useMutation()

  function handleConfirm() {
    setError("")
    mutation.mutate(
      { userId: user.id, venueId, points },
      { onSuccess: (d) => onSuccess(d), onError: (e) => setError(e.message) }
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#0F1115] mb-6">Подтвердить оплату баллами</h2>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
        <Row label="Клиент" value={user.name ?? "—"} />
        <Row label="Заведение" value={venueName} />
        <Row label="Списываем баллов" value={`${points} pts`} />
        <Row label="Остаток у клиента" value={`${user.earnedPoints - points} pts`} />
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onBack} disabled={mutation.isPending} className={btnSecondary + " disabled:opacity-50"}>Назад</button>
        <button onClick={handleConfirm} disabled={mutation.isPending} className="flex-1 bg-[#fd4600] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#c83700] transition-colors disabled:opacity-50">
          {mutation.isPending ? "Обработка…" : "Подтвердить"}
        </button>
      </div>
    </div>
  )
}

// ── Spend: success step ───────────────────────────────────────

function SpendSuccessStep({ result, user, onNew }: { result: SpendResult; user: FoundUser; onNew: () => void }) {
  return (
    <div className="text-center">
      <CheckCircle color="orange" />
      <h2 className="text-xl font-bold text-[#0F1115] mb-1">Баллы приняты!</h2>
      <p className="text-sm text-[#6B7280] mb-6">{user.name} оплатил {result.pointsSpent} баллами</p>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6] text-left mb-6">
        <Row label="Принято баллов" value={`${result.pointsSpent} pts`} highlight />
        <Row label="Остаток у клиента" value={`${result.newEarnedPoints} pts`} />
      </div>
      <button onClick={onNew} className={btnPrimary}>Новая операция</button>
    </div>
  )
}

// ── Shared UI atoms ───────────────────────────────────────────

function UserCard({ user, spend = false }: { user: FoundUser; spend?: boolean }) {
  return (
    <div className="bg-[#F9FAFB] rounded-xl p-4 mb-6 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[#0F1115] flex items-center justify-center text-white text-sm font-bold">
        {(user.name ?? "?")[0]?.toUpperCase()}
      </div>
      <div>
        <p className="font-medium text-[#0F1115] text-sm">{user.name ?? "Клиент"}</p>
        <p className="text-xs text-[#6B7280]">
          {spend
            ? `${user.earnedPoints} pts доступно · ${user.currentStreak} дн. стрик`
            : `${user.totalPoints} pts · ${user.currentStreak} дн. стрик`}
        </p>
      </div>
    </div>
  )
}

function CheckCircle({ color = "green" }: { color?: "green" | "orange" }) {
  const bg = color === "green" ? "bg-[#D1FAE5]" : "bg-[#FEE2D5]"
  const stroke = color === "green" ? "text-[#059669]" : "text-[#fd4600]"
  return (
    <div className={`w-16 h-16 rounded-full ${bg} flex items-center justify-center mx-auto mb-4`}>
      <svg className={`w-8 h-8 ${stroke}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
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

const btnPrimary = "flex-1 bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors"
const btnSecondary = "flex-1 border border-[#D1D5DB] text-[#374151] text-sm font-medium py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors"

// ── Main page ─────────────────────────────────────────────────

export default function PurchasePage() {
  const [venueId, setVenueId]     = useState<string | null>(null)
  const [venueName, setVenueName] = useState("")
  const [mode, setMode]           = useState<Mode | null>(null)
  const [step, setStep]           = useState<Step>("lookup")
  const [user, setUser]           = useState<FoundUser | null>(null)
  const [amount, setAmount]       = useState(0)
  const [points, setPoints]       = useState(0)
  const [awardResult, setAwardResult] = useState<AwardResult | null>(null)
  const [spendResult, setSpendResult] = useState<SpendResult | null>(null)

  function reset() {
    setMode(null); setStep("lookup")
    setUser(null); setAmount(0); setPoints(0)
    setAwardResult(null); setSpendResult(null)
  }

  function onModeSelect(m: Mode) {
    setMode(m)
    setStep("lookup")
  }

  function onUserFound(u: FoundUser) {
    setUser(u)
    setStep(mode === "spend" ? "spend-amount" : "amount")
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">Операция с клиентом</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {venueName ? `Заведение: ${venueName}` : "Начислите или примите баллы лояльности"}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 max-w-md">
        {!venueId ? (
          <VenueSelector onSelect={(id, name) => { setVenueId(id); setVenueName(name) }} />
        ) : !mode ? (
          <ModeSelector onSelect={onModeSelect} />
        ) : step === "lookup" ? (
          <LookupStep onFound={onUserFound} />

        ) : step === "amount" && user ? (
          <AmountStep user={user} onNext={(a) => { setAmount(a); setStep("confirm") }} onBack={() => setMode(null)} />
        ) : step === "confirm" && user ? (
          <ConfirmStep user={user} amount={amount} venueId={venueId!} venueName={venueName}
            onSuccess={(r) => { setAwardResult(r); setStep("success") }} onBack={() => setStep("amount")} />
        ) : step === "success" && user && awardResult ? (
          <SuccessStep result={awardResult} user={user} onNew={reset} />

        ) : step === "spend-amount" && user ? (
          <SpendAmountStep user={user} onNext={(p) => { setPoints(p); setStep("spend-confirm") }} onBack={() => setMode(null)} />
        ) : step === "spend-confirm" && user ? (
          <SpendConfirmStep user={user} points={points} venueId={venueId!} venueName={venueName}
            onSuccess={(r) => { setSpendResult(r); setStep("spend-success") }} onBack={() => setStep("spend-amount")} />
        ) : step === "spend-success" && user && spendResult ? (
          <SpendSuccessStep result={spendResult} user={user} onNew={reset} />
        ) : null}
      </div>
    </div>
  )
}
