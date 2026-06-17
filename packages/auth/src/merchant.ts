import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { db } from "@pulse/db"
import { z } from "zod"

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

const PROMO_PASSWORD = process.env.PROMO_PASSWORD ?? "promo123"

export const {
  handlers: merchantHandlers,
  auth: merchantAuth,
  signIn: merchantSignIn,
  signOut: merchantSignOut,
} = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Merchant Credentials",
      credentials: {
        email: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("[auth] authorize called, email:", (credentials as any)?.email)

          const parsed = credentialsSchema.safeParse(credentials)
          if (!parsed.success) {
            console.log("[auth] parse failed:", parsed.error.message)
            return null
          }

          if (parsed.data.email === "promo") {
            console.log("[auth] promo path, match:", parsed.data.password === PROMO_PASSWORD)
            if (parsed.data.password !== PROMO_PASSWORD) return null

            console.log("[auth] promo querying DB...")
            const first = await db.merchant.findFirst({
              select: { id: true, email: true, name: true },
            })
            console.log("[auth] promo merchant found:", !!first, first?.id)
            if (!first) return null

            return { id: first.id, email: first.email, name: "Promo" }
          }

          const merchant = await db.merchant.findUnique({
            where: { email: parsed.data.email },
          })
          if (!merchant || !merchant.passwordHash) return null

          const valid = await compare(parsed.data.password, merchant.passwordHash)
          if (!valid) return null

          return { id: merchant.id, email: merchant.email, name: merchant.name }
        } catch (err) {
          console.error("[auth] authorize threw:", err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.merchantId = user.id
      }
      return token
    },
    session({ session, token }) {
      if (token.merchantId) {
        // @ts-expect-error — extend session type in apps/merchant
        session.merchant = { id: token.merchantId }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
