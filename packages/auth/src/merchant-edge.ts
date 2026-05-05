import NextAuth from "next-auth"

// Edge-compatible auth — no bcryptjs/Prisma, only JWT verification
export const { auth: merchantAuthEdge } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.merchantId = user.id
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
