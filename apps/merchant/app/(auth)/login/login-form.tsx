"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginForm({ tgBotUsername }: { tgBotUsername: string }) {
  const router = useRouter()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await signIn("credentials", {
        type:     "password",
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError("Неверный логин или пароль")
      } else {
        router.push("/dashboard")
      }
    } catch {
      setError("Ошибка входа. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  const tgLoginUrl = tgBotUsername
    ? `https://t.me/${tgBotUsername}?start=login`
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">

        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="ayoo" className="h-9 w-auto" />
            <span className="text-[#6B7280] font-normal text-lg">Merchant</span>
          </div>
          <p className="mt-1 text-sm text-[#6B7280]">Войдите, чтобы управлять заведением</p>
        </div>

        {/* Telegram button */}
        {tgLoginUrl && (
          <>
            <a
              href={tgLoginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#0F1115] hover:bg-[#F9FAFB] transition-colors mb-4"
            >
              <TelegramIcon />
              Войти через Telegram
            </a>
            <Divider />
          </>
        )}

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F1115] mb-1">Логин</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email или promo"
              required
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#3DBEFF] disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F1115] mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#3DBEFF] disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-[#0F1115] text-white rounded-lg text-sm font-medium hover:bg-[#1F2937] transition-colors disabled:opacity-50"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>

      </div>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-px bg-[#E5E7EB]" />
      <span className="text-xs text-[#9CA3AF]">или</span>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8.02c-.12.56-.46.7-.93.43l-2.57-1.89-1.24 1.19c-.14.13-.25.25-.51.25l.18-2.6 4.7-4.25c.21-.18-.04-.28-.32-.1L7.9 14.47l-2.53-.79c-.55-.17-.56-.55.11-.81l9.87-3.81c.46-.17.86.11.69.74z" fill="#229ED9"/>
    </svg>
  )
}
