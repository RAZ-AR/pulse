"use client"

import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export default function LoginForm({ tgBotUsername }: { tgBotUsername: string }) {
  const router  = useRouter()
  const tgRef   = useRef<HTMLDivElement>(null)

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  // ── Telegram Login Widget ──────────────────────────────────
  useEffect(() => {
    if (!tgBotUsername || !tgRef.current) return

    const container = tgRef.current

    ;(window as any).onTelegramMerchantAuth = async (tgUser: TelegramUser) => {
      setLoading(true)
      setError(null)
      try {
        const res = await signIn("credentials", {
          type:         "telegram",
          telegramData: JSON.stringify(tgUser),
          redirect:     false,
        })
        if (res?.error) {
          setError("Telegram-аккаунт не привязан к мерчанту. Зарегистрируйтесь через бота.")
        } else {
          router.push("/dashboard")
        }
      } catch {
        setError("Ошибка входа через Telegram. Попробуйте снова.")
      } finally {
        setLoading(false)
      }
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.setAttribute("data-telegram-login",  tgBotUsername)
    script.setAttribute("data-size",            "large")
    script.setAttribute("data-radius",          "12")
    script.setAttribute("data-request-access",  "write")
    script.setAttribute("data-onauth",          "onTelegramMerchantAuth")
    script.async = true
    container.appendChild(script)

    return () => {
      delete (window as any).onTelegramMerchantAuth
      container.innerHTML = ""
    }
  }, [tgBotUsername, router])

  // ── Email / password submit ────────────────────────────────
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
        {tgBotUsername ? (
          <>
            <div ref={tgRef} className="flex justify-center mb-4" />
            <Divider />
          </>
        ) : null}

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
