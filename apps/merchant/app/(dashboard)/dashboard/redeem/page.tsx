"use client"

import { useState } from "react"
import { trpc } from "../../../../src/lib/trpc"

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; reward: string; venue: string; points: number }
  | { phase: "error"; reason: string }

export default function RedeemPage() {
  const [code, setCode] = useState("")
  const [state, setState] = useState<State>({ phase: "idle" })

  const validate = trpc.reward.validate.useMutation()

  function handleSubmit() {
    const trimmed = code.trim()
    if (!trimmed) return

    setState({ phase: "loading" })
    validate.mutate(
      { redemptionCode: trimmed },
      {
        onSuccess(data) {
          if (data.valid) {
            setState({
              phase: "success",
              reward: data.redemption.reward.title,
              venue: data.redemption.reward.venue,
              points: data.redemption.pointsSpent,
            })
          } else {
            setState({ phase: "error", reason: data.reason })
          }
        },
        onError(e) {
          setState({ phase: "error", reason: e.message })
        },
      }
    )
  }

  function reset() {
    setCode("")
    setState({ phase: "idle" })
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0F1115]">Validate Reward</h1>
        <p className="text-sm text-[#6B7280] mt-1">Scan or enter the customer&apos;s redemption code</p>
      </div>

      <div className="max-w-md bg-white rounded-xl border border-[#E5E7EB] p-6">
        {state.phase === "success" ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#0F1115] mb-1">Reward validated!</h2>
            <p className="text-sm text-[#6B7280] mb-4">{state.reward} — {state.venue}</p>
            <p className="text-xs text-[#9CA3AF] mb-6">{state.points} pts redeemed</p>
            <button
              onClick={reset}
              className="w-full bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors"
            >
              Validate another
            </button>
          </div>
        ) : state.phase === "error" ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#0F1115] mb-1">Invalid code</h2>
            <p className="text-sm text-[#6B7280] mb-6">{state.reason}</p>
            <button
              onClick={reset}
              className="w-full border border-[#D1D5DB] text-[#374151] text-sm font-medium py-3 rounded-xl hover:bg-[#F9FAFB] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Redemption code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Paste or scan QR code"
              autoFocus
              className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-[#0F1115] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F1115]"
            />
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Code is shown to the customer in their ayoo app after redemption
            </p>
            <button
              onClick={handleSubmit}
              disabled={!code.trim() || state.phase === "loading"}
              className="mt-4 w-full bg-[#0F1115] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#1f2228] transition-colors disabled:opacity-50"
            >
              {state.phase === "loading" ? "Checking…" : "Validate"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
