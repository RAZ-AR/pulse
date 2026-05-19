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

// 2. Add vercel.json for SPA routing
const vercelJson = path.join(distDir, "vercel.json")
fs.writeFileSync(vercelJson, JSON.stringify({
  rewrites: [{ source: "/(.*)", destination: "/index.html" }]
}, null, 2) + "\n")
console.log("✓ Written vercel.json")
