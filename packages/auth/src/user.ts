import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Resend from "next-auth/providers/resend"
import { db } from "@pulse/db"
import { generateReferralCode } from "@pulse/shared"
import { WELCOME_BONUS_AMOUNT, WELCOME_EXPIRY_DAYS } from "@pulse/shared"

function createAdapter() {
  const base = PrismaAdapter(
    db as unknown as Parameters<typeof PrismaAdapter>[0],
  )
  return {
    ...base,
    // Override createUser to inject our custom fields on first sign-in
    createUser: async (data: {
      email: string
      emailVerified: Date | null
      name?: string | null
      image?: string | null
    }) => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + WELCOME_EXPIRY_DAYS)

      // Retry loop in case of referralCode collision (extremely unlikely)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          return await db.user.create({
            data: {
              email: data.email,
              emailVerified: data.emailVerified,
              name: data.name ?? null,
              image: data.image ?? null,
              referralCode: generateReferralCode(),
              welcomePoints: WELCOME_BONUS_AMOUNT,
              welcomeExpiresAt: expiresAt,
            },
          })
        } catch (e: unknown) {
          const isUniqueViolation =
            e instanceof Error && e.message.includes("referralCode")
          if (!isUniqueViolation) throw e
        }
      }
      throw new Error("Failed to generate unique referral code after 5 attempts")
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  session: { strategy: "jwt" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? "ayoo <noreply@ayoo.space>",
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
})
