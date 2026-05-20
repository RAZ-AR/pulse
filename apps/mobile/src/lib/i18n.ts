import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { getLocales } from "expo-localization"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"
import type { SupportedLocale } from "@pulse/shared"

import enCommon from "@pulse/i18n/locales/en/common.json"
import enAuth from "@pulse/i18n/locales/en/auth.json"
import enProfile from "@pulse/i18n/locales/en/profile.json"
import enRewards from "@pulse/i18n/locales/en/rewards.json"
import enCheckin from "@pulse/i18n/locales/en/checkin.json"
import enVenue from "@pulse/i18n/locales/en/venue.json"
import enTransactions from "@pulse/i18n/locales/en/transactions.json"
import enGift from "@pulse/i18n/locales/en/gift.json"

import ruCommon from "@pulse/i18n/locales/ru/common.json"
import ruAuth from "@pulse/i18n/locales/ru/auth.json"
import ruProfile from "@pulse/i18n/locales/ru/profile.json"
import ruRewards from "@pulse/i18n/locales/ru/rewards.json"
import ruCheckin from "@pulse/i18n/locales/ru/checkin.json"
import ruVenue from "@pulse/i18n/locales/ru/venue.json"
import ruTransactions from "@pulse/i18n/locales/ru/transactions.json"
import ruGift from "@pulse/i18n/locales/ru/gift.json"

import srCommon from "@pulse/i18n/locales/sr/common.json"
import srAuth from "@pulse/i18n/locales/sr/auth.json"
import srProfile from "@pulse/i18n/locales/sr/profile.json"
import srRewards from "@pulse/i18n/locales/sr/rewards.json"
import srCheckin from "@pulse/i18n/locales/sr/checkin.json"
import srVenue from "@pulse/i18n/locales/sr/venue.json"
import srTransactions from "@pulse/i18n/locales/sr/transactions.json"
import srGift from "@pulse/i18n/locales/sr/gift.json"

const LOCALE_KEY = "ayoo.locale"
const SUPPORTED: SupportedLocale[] = ["en", "ru", "sr"]

function detectLocale(): SupportedLocale {
  const sys = getLocales()[0]?.languageCode ?? "en"
  return (SUPPORTED as string[]).includes(sys) ? (sys as SupportedLocale) : "en"
}

export async function loadStoredLocale(): Promise<SupportedLocale> {
  try {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LOCALE_KEY)
      if (stored && (SUPPORTED as string[]).includes(stored)) {
        return stored as SupportedLocale
      }
      return detectLocale()
    }
    const stored = await SecureStore.getItemAsync(LOCALE_KEY)
    if (stored && (SUPPORTED as string[]).includes(stored)) {
      return stored as SupportedLocale
    }
  } catch { /* ignore */ }
  return detectLocale()
}

export async function setLocale(locale: SupportedLocale): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_KEY, locale)
  } else {
    await SecureStore.setItemAsync(LOCALE_KEY, locale)
  }
  await i18n.changeLanguage(locale)
}

export async function initI18n(): Promise<void> {
  const locale = await loadStoredLocale()
  await i18n.use(initReactI18next).init({
    resources: {
      en: {
        common: enCommon, auth: enAuth, profile: enProfile,
        rewards: enRewards, checkin: enCheckin, venue: enVenue, transactions: enTransactions, gift: enGift,
      },
      ru: {
        common: ruCommon, auth: ruAuth, profile: ruProfile,
        rewards: ruRewards, checkin: ruCheckin, venue: ruVenue, transactions: ruTransactions, gift: ruGift,
      },
      sr: {
        common: srCommon, auth: srAuth, profile: srProfile,
        rewards: srRewards, checkin: srCheckin, venue: srVenue, transactions: srTransactions, gift: srGift,
      },
    },
    lng: locale,
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "auth", "profile", "rewards", "checkin", "venue", "transactions", "gift"],
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  })
}

export { i18n }
