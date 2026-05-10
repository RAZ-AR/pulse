import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/*
          NOTE: Do NOT load telegram-web-app.js here.
          Inside Telegram's native WebView, window.Telegram.WebApp is already
          injected by the native Telegram app BEFORE any scripts run — no SDK needed.
          Loading the SDK asynchronously actually interferes: the script can temporarily
          overwrite window.Telegram during its initialization, causing our detection
          to return false at the wrong moment.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
