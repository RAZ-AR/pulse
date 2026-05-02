import { create } from "zustand"
import { getSessionToken, setSessionToken } from "../lib/trpc"

type AuthState = {
  token: string | null
  hydrated: boolean
  hydrate: () => Promise<void>
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  hydrated: false,
  async hydrate() {
    const token = await getSessionToken()
    set({ token, hydrated: true })
  },
  async signIn(token) {
    await setSessionToken(token)
    set({ token })
  },
  async signOut() {
    await setSessionToken(null)
    set({ token: null })
  },
}))
