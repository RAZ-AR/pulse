/* ayoo landing — hero game + track toggle + i18n wiring. */
(function () {
  const { PET_ORDER, PET_NAMES, PET_THRESH, TamaScreen, spriteDataURL } = window.ayooPets
  const { applyLang, detectLang, t } = window.ayooI18n
  const BOT = "ayoo_loyalty_bot"

  const STAT_LABELS = ["HUNGER", "HYGIENE", "SMARTS", "ACTIVE", "ENERGY", "HAPPY"]

  // ── state ──
  let state = "egg"     // egg → live
  let eggTaps = 0
  let petKey = "EGG"
  let petName = ""
  let coins = 0
  let stageIdx = -1     // index into PET_ORDER reached via scroll

  const $ = (s) => document.querySelector(s)
  const lcd = new TamaScreen($("#lcd"), { px: 6 })
  lcd.setPet("EGG"); lcd.start()

  // ambient pet on the business hero
  const bizCanvas = $("#lcdBiz")
  if (bizCanvas) { const b = new TamaScreen(bizCanvas, { px: 6 }); b.setPet("DRAGON"); b.start() }

  // ── stat bars ──
  function renderStats(fill) {
    $("#stats").innerHTML = STAT_LABELS.map((l, i) => {
      const v = Math.round(Math.min(1, (fill ?? 0) + i * 0.04) * 100)
      return `<div class="stat"><div class="lbl">${l}</div><div class="bar"><i style="width:${v}%"></i></div></div>`
    }).join("")
  }
  renderStats(0.1)

  // ── deep link ──
  function b64url(s) {
    try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
    catch { return "" }
  }
  function updateCta() {
    const key = state === "egg" ? "HATCHLING" : petKey
    let param = "pet-" + key
    if (petName) param += "-" + b64url(petName).slice(0, 40)
    const url = `https://t.me/${BOT}?startapp=${param}`
    $("#heroCta").href = url
    const cta2 = $("#heroCta2"); if (cta2) cta2.href = url
    const qr = $("#qr")
    if (qr) qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(url)}`
  }

  // evolution ladder
  function renderLadder() {
    const el = $("#ladder"); if (!el) return
    el.innerHTML = PET_ORDER.map((k) =>
      `<div class="evo"><div class="scr"><img src="${spriteDataURL(k, 6)}" alt="${k}"></div>
       <div class="nm">${PET_NAMES[k]}</div><div class="pt">${PET_THRESH[k].toLocaleString()} pts</div></div>`).join("")
  }
  renderLadder()
  updateCta()

  // ── egg → hatch ──
  function setName(name) {
    petName = name
    $("#petName").textContent = (name || PET_NAMES[petKey] || "").toUpperCase()
    updateCta()
  }
  function evolveTo(idx) {
    idx = Math.max(0, Math.min(PET_ORDER.length - 1, idx))
    if (idx === stageIdx) return
    stageIdx = idx
    petKey = PET_ORDER[idx]
    lcd.setPet(petKey)
    if (!petName) $("#petName").textContent = PET_NAMES[petKey].toUpperCase()
    lcd.jump()
    updateCta()
  }
  function hatch() {
    state = "live"
    $("#hint").style.display = "none"
    evolveTo(0)                    // HATCHLING
    $("#namebar").classList.add("show")
    $("#tip").textContent = ""
    lcd.jump()
  }

  $("#lcd").addEventListener("click", () => {
    if (state === "egg") {
      eggTaps++
      if (eggTaps >= 3) hatch()
    }
  })

  // name field
  $("#nameOk").addEventListener("click", () => {
    const v = $("#nameInput").value.trim()
    if (v) { setName(v); $("#tip").textContent = t("hero.named") }
    $("#namebar").classList.remove("show")
  })
  $("#nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#nameOk").click() })

  // control buttons
  document.querySelectorAll("[data-ctl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-ctl")
      if (state === "egg") hatch()
      if (k === "feed") { coins += 50; lcd.setHungry(false); lcd.jump(); $("#tip").textContent = t("btn.feed") }
      if (k === "play") { lcd.jump(); $("#tip").textContent = t("btn.play") }
      if (k === "stats") { $("#tip").textContent = t("btn.stats") }
      $("#coins").textContent = coins
    })
  })

  // ── scroll = feeding / evolution ──
  function onScroll() {
    const max = document.body.scrollHeight - window.innerHeight
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0
    renderStats(0.1 + p * 0.9)
    if (state !== "egg") {
      coins = Math.round(p * 8200)
      $("#coins").textContent = coins
      evolveTo(Math.floor(p * (PET_ORDER.length - 0.001)))
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true })

  // ── track toggle ──
  document.querySelectorAll("[data-track]").forEach((b) => {
    b.addEventListener("click", () => {
      const track = b.getAttribute("data-track")
      document.querySelectorAll("[data-track]").forEach((x) => x.classList.toggle("on", x === b))
      document.querySelectorAll("[data-track-panel]").forEach((p) =>
        p.hidden = p.getAttribute("data-track-panel") !== track)
      window.scrollTo(0, 0)
    })
  })

  // ── language ──
  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => { applyLang(b.getAttribute("data-lang")); refreshNames() }))
  function refreshNames() {
    if (state !== "egg") $("#petName").textContent = (petName || PET_NAMES[petKey]).toUpperCase()
  }
  applyLang(detectLang())
})();
