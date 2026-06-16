#!/usr/bin/env node
// Post-build: inject Telegram SDK and vercel.json into dist/
const fs = require("fs")
const path = require("path")

const distDir = path.join(__dirname, "../dist")
const htmlPath = path.join(distDir, "index.html")

// 1. Inject telegram-web-app.js before the React bundle (both deferred — SDK runs first)
let html = fs.readFileSync(htmlPath, "utf8")
const tgScript = '<script src="https://telegram.org/js/telegram-web-app.js" defer></script>\n  '
if (!html.includes("telegram-web-app.js")) {
  html = html.replace('<script src="/_expo/', tgScript + '<script src="/_expo/')
  fs.writeFileSync(htmlPath, html)
  console.log("✓ Injected telegram-web-app.js into index.html")
} else {
  console.log("✓ telegram-web-app.js already present")
}

// 1b. Inject web fonts: pixel LCD + editorial serif headings.
const fontLink =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Press+Start+2P&family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">\n  '
if (!html.includes("Instrument+Serif") || !html.includes("Press+Start+2P") || !html.includes("Roboto:wght")) {
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Press\+Start\+2P&display=swap" rel="stylesheet">\s*/g, "")
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Instrument\+Serif:ital@0;1&family=Press\+Start\+2P&display=swap" rel="stylesheet">\s*/g, "")
  html = html.replace("</head>", fontLink + "</head>")
  fs.writeFileSync(htmlPath, html)
  console.log("✓ Injected web fonts into index.html")
} else {
  console.log("✓ web fonts already present")
}

// 2. Add vercel.json for SPA routing.
//    dist/ is already a fully-built static export — disable any server-side
//    build/install so Vercel just serves these files as-is.
// Find the current JS bundle so stale clients asking for an old (deleted)
// entry-*.js get the live bundle instead of index.html (which broke parsing
// and left Telegram WebViews stuck on a spinner forever).
const bundleDir = path.join(distDir, "_expo/static/js/web")
const bundleName = fs.readdirSync(bundleDir).find((f) => /^entry-[a-f0-9]+\.js$/.test(f))
if (!bundleName) { console.error("✗ no entry-*.js bundle found in dist"); process.exit(1) }

const vercelJson = path.join(distDir, "vercel.json")
fs.writeFileSync(vercelJson, JSON.stringify({
  framework: null,
  buildCommand: null,
  installCommand: null,
  outputDirectory: ".",
  rewrites: [
    // Old cached HTML shells reference deleted bundle hashes — serve the
    // current bundle for any entry-*.js (existing files win over rewrites).
    { source: "/_expo/static/js/web/:name*", destination: `/_expo/static/js/web/${bundleName}` },
    { source: "/(.*)", destination: "/index.html" },
  ],
  // Never cache the HTML shell — so Telegram's WebView always loads the
  // newest hashed JS bundle instead of a stale cached version.
  headers: [
    { source: "/", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
    { source: "/index.html", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
  ],
}, null, 2) + "\n")
console.log("✓ Written vercel.json")
