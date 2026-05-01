import { getRequestConfig } from "next-intl/server"
import type { SupportedLocale } from "@pulse/shared"

export { getRequestConfig }

export async function getTranslator(locale: SupportedLocale, namespace: string) {
  const messages = await import(`./locales/${locale}/${namespace}.json`)
  return messages.default as Record<string, string>
}

export const locales: SupportedLocale[] = ["en", "ru", "sr"]
export const defaultLocale: SupportedLocale = "en"
