import type { Scenes } from "telegraf"
import type { Merchant } from "@pulse/db"

export interface WizardState extends Scenes.WizardSessionData {
  name: string
  category: string
  city: string
  address: string
  social: string
  phone: string
  email: string
  taxId: string
  preferredRate: number
  awaitingCustomCity: boolean
  awaitingCustomRate: boolean

  venueId: string
  venueName: string
  venues: { id: string; name: string }[]
  offerType: string
  title: string
  description: string
  pointsReward: number
  endsAt?: string
  awaitingCustomDate: boolean
  awaitingCustomLimit: boolean

  userId: string
  userName: string
  userPoints: number
  amount: number
}

interface SessionData extends Scenes.WizardSession<WizardState> {
  merchant?: Merchant & { pointsBalance: number }
}

export interface Context extends Scenes.WizardContext<WizardState> {
  session: SessionData
  merchantData?: Merchant & { pointsBalance: number }
}
