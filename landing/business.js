/* ayoo landing — business calculator + lead form. */
(function () {
  const { t } = window.ayooI18n
  const $ = (s) => document.querySelector(s)
  const fmt = (n) => Math.round(n).toLocaleString()

  function calc() {
    const check = +($("#calcCheck")?.value || 0)
    const visits = +($("#calcVisits")?.value || 0)
    const extraVisits = visits * 0.15           // illustrative: +15% repeat visits
    const extraRevenue = extraVisits * check
    const out = $("#calcOut")
    if (out) out.innerHTML = t("calc.res")
      .replace("{v}", `<b>${fmt(extraVisits)}</b>`)
      .replace("{r}", `<b>${fmt(extraRevenue)}</b>`)
  }
  ;["#calcCheck", "#calcVisits"].forEach((s) => $(s)?.addEventListener("input", calc))
  document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setTimeout(calc, 0)))
  setTimeout(calc, 0)

  const form = $("#leadForm")
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault()
    const lead = {
      name: $("#lf_name").value, venue: $("#lf_venue").value,
      city: $("#lf_city").value, contact: $("#lf_contact").value,
      source: "landing-v2", lang: window.ayooI18n.lang,
    }
    try {
      const all = JSON.parse(localStorage.getItem("ayoo_leads") || "[]")
      all.push({ ...lead, t: Date.now() })
      localStorage.setItem("ayoo_leads", JSON.stringify(all))
    } catch (_) { /* ignore */ }
    const done = $("#leadOk")
    done.style.display = "none"
    fetch("https://api.ayoo.space/api/partner-lead", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead),
    })
      .then((res) => {
        if (!res.ok) throw new Error("lead_failed")
        done.textContent = t("form.done")
        done.style.display = "block"
        form.reset(); calc()
      })
      .catch(() => {
        done.textContent = "Could not send. Please try again."
        done.style.display = "block"
      })
  })
})();
