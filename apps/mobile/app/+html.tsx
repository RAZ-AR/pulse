import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <script src="https://telegram.org/js/telegram-web-app.js" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                font-family: "Helvetica Neue", Arial, SpaceGrotesk_600SemiBold, sans-serif;
                letter-spacing: 0;
              }
              div, span, button, input, textarea {
                font-family: inherit;
                letter-spacing: 0;
              }
              [style*="-apple-system"], [style*="system-ui"] {
                font-family: "Helvetica Neue", Arial, SpaceGrotesk_600SemiBold, sans-serif !important;
              }
              div[dir="auto"]:not([style]), span[dir="auto"]:not([style]) {
                font-family: "Helvetica Neue", Arial, SpaceGrotesk_600SemiBold, sans-serif !important;
              }
            `,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
