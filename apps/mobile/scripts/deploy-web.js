#!/usr/bin/env node
// Deploy dist/ to Vercel and update app.ayoo.space alias
const { execSync } = require("child_process")
const https = require("https")
const fs = require("fs")

const TEAM = "team_OaJPAnzFHgtpCemoxyHEh6ol"
const DIST_PROJECT_ID = "prj_NRiA3fzgFRfJqxYw9T16jZs5qc9p"
const ALIAS = "app.ayoo.space"

function getToken() {
  const authPath = require("os").homedir() + "/Library/Application Support/com.vercel.cli/auth.json"
  return JSON.parse(fs.readFileSync(authPath, "utf8")).token
}

function patchProject(token, projectId, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: "api.vercel.com",
      path: `/v9/projects/${projectId}?teamId=${TEAM}`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": data.length },
    }, (res) => {
      let b = ""
      res.on("data", c => b += c)
      res.on("end", () => resolve(JSON.parse(b)))
    })
    req.on("error", reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  const token = getToken()

  // Deploy
  console.log("Deploying dist/ to Vercel...")
  const output = execSync(
    `vercel deploy dist --prod --scope razars-projects --yes`,
    { cwd: require("path").join(__dirname, ".."), encoding: "utf8" }
  )
  console.log(output)

  // Extract deployment URL
  const match = output.match(/https:\/\/dist-[a-z0-9]+-razars-projects\.vercel\.app/)
  if (!match) { console.error("Could not find deployment URL"); process.exit(1) }
  const deployUrl = match[0].replace("https://", "")
  console.log("Deployment URL:", deployUrl)

  // Disable SSO
  await patchProject(token, DIST_PROJECT_ID, { ssoProtection: null })
  console.log("✓ SSO disabled")

  // Update alias
  execSync(`vercel alias ${deployUrl} ${ALIAS}`, { encoding: "utf8", stdio: "inherit" })
  console.log(`✓ ${ALIAS} updated`)
}

main().catch(e => { console.error(e); process.exit(1) })
