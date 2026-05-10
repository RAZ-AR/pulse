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
          Load Telegram Mini App SDK synchronously before the app bundle.
          React strips <script src> tags, so we inject it via dangerouslySetInnerHTML.
          Inside Telegram's native WebView window.Telegram.WebApp is already injected
          by the native app; this script is the fallback for other environments.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js';s.async=false;document.head.appendChild(s);})();`,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
