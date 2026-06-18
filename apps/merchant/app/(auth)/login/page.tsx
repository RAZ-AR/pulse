import LoginForm from "./login-form"

// Server Component — reads bot username from env (no NEXT_PUBLIC_ needed)
export default function LoginPage() {
  return (
    <LoginForm tgBotUsername={process.env.PARTNER_TELEGRAM_BOT_USERNAME ?? ""} />
  )
}
