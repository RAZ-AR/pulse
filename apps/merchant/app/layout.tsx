import type { Metadata } from "next"
import { Providers } from "../src/components/providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "ayoo Merchant",
  description: "Manage your ayoo loyalty program",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F9FAFB]">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
