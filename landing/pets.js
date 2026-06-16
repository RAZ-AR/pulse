/* ayoo pets — Space-Invaders sprites + a tiny LCD animator (canvas).
   Sprites are ported 1:1 from apps/mobile/src/components/AyooPet.tsx. */

const PET_SPRITES = {
  EGG: [
    ["..KKKK..", ".KKKKKK.", "KKKKKKKK", "KK.KK.KK", "KKKKKKKK", "KKKKKKKK", ".KKKKKK.", "..KKKK.."],
    ["..KKKK..", ".KKKKKK.", "KKKKKKKK", "KKKKKKKK", "KK.KK.KK", "KKKKKKKK", ".KKKKKK.", "..KKKK.."],
  ],
  HATCHLING: [
    ["...KK...", "..KKKK..", ".KKKKKK.", "KK.KK.KK", "KKKKKKKK", "..K..K..", ".K.KK.K.", "K.K..K.K"],
    ["...KK...", "..KKKK..", ".KKKKKK.", "KK.KK.KK", "KKKKKKKK", ".K.KK.K.", "K......K", ".K....K."],
  ],
  KID: [
    ["..K.....K..", "...K...K...", "..KKKKKKK..", ".KK.KKK.KK.", "KKKKKKKKKKK", "K.KKKKKKK.K", "K.K.....K.K", "...KK.KK..."],
    ["..K.....K..", "K..K...K..K", "K.KKKKKKK.K", "KKK.KKK.KKK", "KKKKKKKKKKK", ".KKKKKKKKK.", "..K.....K..", ".K.......K."],
  ],
  FOX: [
    ["....KKKK....", ".KKKKKKKKKK.", "KKKKKKKKKKKK", "KKK..KK..KKK", "KKKKKKKKKKKK", "...KK..KK...", "..KK.KK.KK..", "KK........KK"],
    ["....KKKK....", ".KKKKKKKKKK.", "KKKKKKKKKKKK", "KKK..KK..KKK", "KKKKKKKKKKKK", "..KKK..KKK..", ".KK..KK..KK.", "..KK....KK.."],
  ],
  DRAGON: [
    ["K....KKK....K", ".K..KKKKK..K.", "..KKKKKKKKK..", ".KKK.KKK.KKK.", "KKKKKKKKKKKKK", "KKKKKKKKKKKKK", "K.KKK.K.KKK.K", "K.K.......K.K", "...KK...KK..."],
    [".K...KKK...K.", "K...KKKKK...K", "..KKKKKKKKK..", ".KKK.KKK.KKK.", "KKKKKKKKKKKKK", "KKKKKKKKKKKKK", ".KKKK.K.KKKK.", "..K.......K..", ".KK.......KK."],
  ],
  PHOENIX: [
    ["K....KKK....K", "KK..KKKKK..KK", ".KKKKKKKKKKK.", "..KK.KKK.KK..", "KKKKKKKKKKKKK", "KKKKKKKKKKKKK", ".KKKKKKKKKKK.", "..K..KKK..K..", ".K...K.K...K."],
    [".K...KKK...K.", "..KKKKKKKKK..", ".KKKKKKKKKKK.", "..KK.KKK.KK..", "KKKKKKKKKKKKK", "KKKKKKKKKKKKK", "KKKKKKKKKKKKK", ".KK..K.K..KK.", "K.K.......K.K"],
  ],
}

const PET_ORDER  = ["HATCHLING", "KID", "FOX", "DRAGON", "PHOENIX"]
const PET_NAMES  = { EGG: "Egg", HATCHLING: "Hatchling", KID: "Kid", FOX: "Fox", DRAGON: "Dragon", PHOENIX: "Phoenix" }
const PET_THRESH = { HATCHLING: 500, KID: 1500, FOX: 3000, DRAGON: 5000, PHOENIX: 8000 }

const INK = "#1A1208"
const DOT = "#cbcbcb"

/* Animated LCD: dot grid + a pet that walks, jumps and idles. */
class TamaScreen {
  constructor(canvas, { px = 6 } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.px = px
    this.petKey = "EGG"
    this.frame = 0
    this.hopT = 0          // jump impulse (0..1)
    this.hungry = false
    this._lastFrameSwap = 0
    this._raf = null
    this._resize()
    window.addEventListener("resize", () => this._resize())
    canvas.addEventListener("click", () => this.jump())
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(r.width * dpr)
    this.canvas.height = Math.round(r.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.W = r.width
    this.H = r.height
  }

  setPet(key) { this.petKey = key }
  jump() { this.hopT = 1 }
  setHungry(v) { this.hungry = v }

  start() { if (!this._raf) this._loop(performance.now()) }
  stop() { cancelAnimationFrame(this._raf); this._raf = null }

  _loop(now) {
    this._raf = requestAnimationFrame((t) => this._loop(t))
    if (now - this._lastFrameSwap > 480) { this.frame ^= 1; this._lastFrameSwap = now }
    this.hopT = Math.max(0, this.hopT - 0.045)
    this._draw(now)
  }

  _drawDots() {
    const { ctx, W, H } = this
    ctx.fillStyle = DOT
    for (let y = 4; y < H; y += 7)
      for (let x = 4; x < W; x += 7) ctx.fillRect(x, y, 1.4, 1.4)
  }

  _draw(now) {
    const { ctx, W, H, px } = this
    ctx.clearRect(0, 0, W, H)
    this._drawDots()

    const frames = PET_SPRITES[this.petKey] || PET_SPRITES.HATCHLING
    const rows = frames[this.frame] || frames[0]
    const sw = rows[0].length * px
    const sh = rows.length * px

    // gentle walk + jump + hungry shake
    const walk = Math.sin(now / 900) * (W * 0.16)
    const hop = -Math.sin(this.hopT * Math.PI) * 22
    const shake = this.hungry ? Math.sin(now / 60) * 2 : 0
    const ox = Math.round((W - sw) / 2 + walk + shake)
    const oy = Math.round((H - sh) / 2 + hop)

    ctx.fillStyle = INK
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "K") ctx.fillRect(ox + c * px, oy + r * px, px, px)
      }
    }

    if (this.hungry) {
      ctx.fillStyle = "#ea5b0c"
      ctx.fillRect(W - 16, 10, 6, 6)
    }
  }
}

/* Static sprite → data URL (for collection icons, no animation). */
function spriteDataURL(key, px = 4, frame = 0) {
  const rows = (PET_SPRITES[key] || PET_SPRITES.HATCHLING)[frame]
  const w = rows[0].length * px, h = rows.length * px
  const cv = document.createElement("canvas")
  cv.width = w; cv.height = h
  const ctx = cv.getContext("2d")
  ctx.fillStyle = INK
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++)
      if (rows[r][c] === "K") ctx.fillRect(c * px, r * px, px, px)
  return cv.toDataURL()
}

window.ayooPets = { PET_SPRITES, PET_ORDER, PET_NAMES, PET_THRESH, TamaScreen, spriteDataURL }
