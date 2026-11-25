(() => {
  "use strict";

  /* Settings. API stays empty until the Microsoft logging endpoint is live;
     until then forms fall back to WhatsApp or email and nothing is logged. */
  const API = "";
  const WHATSAPP = "573165215117";
  const MAIL = "william@jutte.co";
  const POLICY_VERSION = "2026-11-24";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wa = text => "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text);

  /* Mobile menu */
  const menuBtn = $(".menu-btn");
  const menu = $("#menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => {
      const open = menuBtn.getAttribute("aria-expanded") !== "true";
      menuBtn.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("open", open);
    });
    menu.addEventListener("click", e => {
      if (e.target.closest("a")) { menuBtn.setAttribute("aria-expanded", "false"); menu.classList.remove("open"); }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && menu.classList.contains("open")) { menuBtn.setAttribute("aria-expanded", "false"); menu.classList.remove("open"); menuBtn.focus(); }
    });
  }

  /* Reveal on scroll */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* Scroll story */
  const mail = $("#story-mail");
  if (mail) {
    const steps = $$(".step");
    const setStep = n => { mail.dataset.step = n; steps.forEach(s => s.classList.toggle("active", s.dataset.step === String(n))); };
    setStep(1);
    if ("IntersectionObserver" in window) {
      const wide = matchMedia("(min-width: 56rem)");
      let so;
      const watch = () => {
        if (so) so.disconnect();
        so = new IntersectionObserver(entries => {
          for (const e of entries) if (e.isIntersecting) setStep(e.target.dataset.step);
        }, { rootMargin: wide.matches ? "-50% 0px -49% 0px" : "-78% 0px -21% 0px" });
        steps.forEach(s => so.observe(s));
      };
      watch();
      wide.addEventListener("change", watch);
    } else {
      steps.forEach(s => s.classList.add("active"));
    }
  }

  /* Sending to the endpoint. text/plain keeps it a simple request (no preflight). */
  async function send(payload) {
    if (!API) return false;
    try {
      const r = await fetch(API, {
        method: "POST", mode: "cors", keepalive: true, referrerPolicy: "no-referrer",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(Object.assign({ pagina: location.pathname }, payload))
      });
      return r.ok;
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Lead forms (result gate and contact page) */
  function wireForm(form, extra) {
    const err = $(".msg", form);
    const done = $(".done", form.parentElement) || $(".done", form);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const nombre = (data.nombre || "").trim();
      const correo = (data.correo || "").trim();
      const fail = t => { err.textContent = t; err.hidden = false; };
      if (!nombre) return fail("Escriba su nombre.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return fail("Revise su correo: debe verse así, nombre@suempresa.com.co.");
      if (!form.elements.consentimiento.checked) return fail("Para responderle necesitamos su autorización para usar estos datos.");
      const payload = Object.assign({}, extra ? extra() : {}, {
        tipo: form.dataset.lead, nombre, correo,
        whatsapp: (data.whatsapp || "").trim(), empresa: (data.empresa || "").trim(),
        servicio: data.servicio || "", mensaje: (data.mensaje || "").trim(),
        consentimiento: true, politica: POLICY_VERSION
      });
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      const ok = await send(payload);
      btn.disabled = false;
      const subject = payload.dominio ? payload.dominio : payload.empresa || "Jutte";
      if (ok) {
        form.hidden = true;
        done.textContent = form.dataset.lead === "contacto"
          ? "Recibido, " + nombre + ". Le respondemos a " + correo + " el mismo día hábil o el siguiente."
          : "Listo, " + nombre + ". Le enviamos el informe de " + subject + " a " + correo + " en el siguiente día hábil.";
        done.hidden = false;
        return;
      }
      const lines = ["Hola, soy " + nombre + " (" + correo + (payload.whatsapp ? ", " + payload.whatsapp : "") + ")."];
      if (form.dataset.lead === "contacto") {
        if (payload.empresa) lines.push("Empresa: " + payload.empresa + ".");
        if (payload.servicio) lines.push("Me interesa: " + payload.servicio + ".");
        if (payload.mensaje) lines.push(payload.mensaje);
      } else {
        lines.push("Quiero el informe completo de " + subject + ".");
      }
      const text = lines.join("\n");
      form.hidden = true;
      done.replaceChildren(
        el("p", null, "Gracias, " + nombre + ". Para terminar, envíenos su solicitud por uno de estos medios:"),
      );
      const row = el("div", "form-actions");
      const a1 = el("a", "btn btn-green", "Enviar por WhatsApp");
      a1.href = wa(text); a1.target = "_blank"; a1.rel = "noopener";
      const a2 = el("a", "btn btn-line", "Enviar por correo");
      a2.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent((form.dataset.lead === "contacto" ? "Contacto: " : "Informe completo: ") + subject) + "&body=" + encodeURIComponent(text);
      row.append(a1, a2);
      done.append(row);
      done.hidden = false;
    });
  }

  $$("form[data-lead=contacto]").forEach(f => {
    const pick = { diagnostico: "Diagnóstico de Microsoft 365", blindaje: "Blindaje de correo y cuentas", vigilancia: "Plan Vigilancia", chequeo: "Chequeo de correo" }[new URLSearchParams(location.search).get("servicio")];
    if (pick && f.elements.servicio) f.elements.servicio.value = pick;
    wireForm(f);
  });

  /* Domain checker */
  const form = $("#check");
  if (!form) return;
  const DOH = "https://dns.google/resolve";
  const FREE = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
    "live.com", "msn.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me"]);
  const input = $("#dominio");
  const btn = $("#check-btn");
  const msg = $("#check-msg");
  const out = $("#result");
  const section = $("#revisar");
  let current = null;

  function normalize(raw) {
    let s = String(raw || "").trim().toLowerCase();
    if (!s) return "";
    if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[\/?#:\s]/)[0];
    s = s.replace(/^www\./, "").replace(/\.+$/, "");
    try { s = new URL("http://" + s).hostname; } catch (e) { return null; }
    return /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(s) ? s : null;
  }

  async function query(name, type) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(DOH + "?name=" + encodeURIComponent(name) + "&type=" + type,
        { signal: ctrl.signal, cache: "no-store", referrerPolicy: "no-referrer" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  const answers = (j, type) => (j && Array.isArray(j.Answer) ? j.Answer.filter(a => a.type === type).map(a => String(a.data)) : []);
  const unquote = d => {
    const parts = [...d.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\(.)/g, "$1"));
    return parts.length ? parts.join("") : d;
  };

  /* Technical analysis: kept for the log, never shown to the visitor. */
  function analyze(mx, txt, dmarcJ, dkimMs, dkimG) {
    const mxHosts = answers(mx, 15).map(x => x.trim().split(/\s+/).pop().replace(/\.$/, "").toLowerCase());
    let plataforma = "ninguna";
    if (mxHosts.some(h => /\.mail\.protection\.outlook\.com$|\.mx\.microsoft$/.test(h))) plataforma = "microsoft365";
    else if (mxHosts.some(h => /(^|\.)google(mail)?\.com$/.test(h))) plataforma = "google";
    else if (mxHosts.length) plataforma = "otro";

    const spfRecs = answers(txt, 16).map(unquote).filter(t => /^v=spf1(\s|$)/i.test(t.trim()));
    let spf;
    if (!spfRecs.length) spf = "falta";
    else if (spfRecs.length > 1) spf = "duplicado";
    else {
      const m = spfRecs[0].match(/(?:^|\s)([+\-~?]?)all(?=\s|$)/i);
      if (!m) spf = /redirect=/i.test(spfRecs[0]) ? "redirect" : "sin-all";
      else spf = { "-": "estricto", "~": "suave", "?": "neutral", "+": "abierto", "": "abierto" }[m[1]];
    }

    const dmarcRecs = answers(dmarcJ, 16).map(unquote).filter(t => /^v=dmarc1\s*(;|$)/i.test(t.trim()));
    let dmarc;
    if (!dmarcRecs.length) dmarc = "falta";
    else if (dmarcRecs.length > 1) dmarc = "duplicado";
    else {
      const pm = dmarcRecs[0].match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i);
      const p = pm ? pm[1].toLowerCase() : "";
      dmarc = ["none", "quarantine", "reject"].includes(p) ? p : "invalido";
    }

    let dkim = "no-aplica";
    if (plataforma === "microsoft365") dkim = answers(dkimMs, 5).length ? "si" : "no";
    else if (plataforma === "google") dkim = answers(dkimG, 16).some(t => /v=dkim1|k=rsa|p=/i.test(unquote(t))) ? "si" : "no";

    const severe = ["falta", "duplicado", "invalido", "none"].includes(dmarc) || ["falta", "duplicado", "abierto"].includes(spf);
    let puntos = 0;
    if (!["estricto", "redirect"].includes(spf)) puntos++;
    if (dmarc !== "reject") puntos++;
    if (dkim === "no") puntos++;
    const nivel = severe ? "alto" : puntos ? "medio" : "bajo";
    return { plataforma, spf, dmarc, dkim, puntos, nivel, mx: mxHosts.slice(0, 3).join(" ") };
  }

  const COPY = {
    alto: {
      label: "Riesgo alto",
      title: d => "Hoy alguien podría enviar correos con el nombre de " + d + ".",
      sub: "Y llegarían a la bandeja de entrada de sus clientes y de su propio equipo, sin ninguna advertencia.",
      gateTitle: "Reciba el informe completo, gratis",
      gateText: "Le explicamos qué falta, qué riesgo trae y cómo cerrarlo, en palabras simples. Se lo enviamos en un día hábil.",
      cta: "Recibir el informe"
    },
    medio: {
      label: "Riesgo medio",
      title: d => d + " tiene protección, pero con huecos.",
      sub: "Algunos correos falsos con su nombre todavía podrían llegar a quien no deben.",
      gateTitle: "Reciba el informe completo, gratis",
      gateText: "Le explicamos qué falta y cómo cerrarlo, en palabras simples. Se lo enviamos en un día hábil.",
      cta: "Recibir el informe"
    },
    bajo: {
      label: "Riesgo bajo",
      title: d => "El correo de " + d + " está bien protegido en lo básico.",
      sub: "El siguiente riesgo suele estar en las cuentas: contraseñas, accesos y administradores.",
      gateTitle: "¿Revisamos también sus cuentas?",
      gateText: "Le contamos cómo funciona el diagnóstico de Microsoft 365 y cuánto cuesta para su empresa.",
      cta: "Quiero saber más"
    }
  };

  function render(domain, res) {
    const c = COPY[res.nivel];
    out.replaceChildren();
    out.classList.remove("reveal");
    out.append(el("span", "level level-" + res.nivel, c.label));
    out.append(el("h2", null, c.title(domain)));
    out.append(el("p", "sub", c.sub));
    const meter = el("div", "meter " + res.nivel);
    meter.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) meter.append(el("span"));
    const cap = el("p", "meter-cap");
    cap.setAttribute("aria-hidden", "true");
    cap.append(el("span", null, "Alto"), el("span", null, "Medio"), el("span", null, "Bajo"));
    out.append(meter, cap);
    out.append(el("p", "weak", res.puntos === 0
      ? "No encontramos puntos débiles en la protección básica de su correo."
      : res.puntos === 1
        ? "Encontramos 1 punto débil en la protección de su correo."
        : "Encontramos " + res.puntos + " puntos débiles en la protección de su correo."));

    const gate = el("div", "gate");
    gate.append(el("h3", null, c.gateTitle), el("p", null, c.gateText));
    const f = document.createElement("form");
    f.noValidate = true;
    f.dataset.lead = res.nivel === "bajo" ? "diagnostico" : "informe";
    f.innerHTML =
      '<div class="form-grid two">' +
      '<div><label for="g-nombre">Nombre</label><input class="field" id="g-nombre" name="nombre" autocomplete="name"></div>' +
      '<div><label for="g-correo">Correo de trabajo</label><input class="field" id="g-correo" name="correo" type="email" autocomplete="email" placeholder="nombre@suempresa.com.co"></div>' +
      '<div class="full"><label for="g-wa">WhatsApp <span class="opt">(opcional)</span></label><input class="field" id="g-wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="300 123 4567"></div>' +
      '<label class="consent full"><input type="checkbox" name="consentimiento"><span>Autorizo a Jutte a usar estos datos para enviarme el informe y contactarme, según su <a href="privacidad.html">política de tratamiento de datos</a>.</span></label>' +
      "</div>" +
      '<p class="msg" role="alert" hidden></p>' +
      '<div class="form-actions"><button class="btn btn-green" type="submit"></button><a class="link-arrow" target="_blank" rel="noopener">Prefiero hablar por WhatsApp</a></div>';
    $("button", f).textContent = c.cta;
    $("a.link-arrow", f).href = wa("Hola, revisé " + domain + " en jutte.co y quiero hablar sobre el resultado.");
    const done = el("div", "done");
    done.hidden = true;
    done.setAttribute("role", "status");
    gate.append(f, done);
    out.append(gate);
    wireForm(f, () => ({ dominio: domain, nivel: res.nivel }));

    out.hidden = false;
    void out.offsetWidth;
    out.classList.add("reveal");
  }

  function showMsg(text) { msg.textContent = text; msg.hidden = false; out.hidden = true; }

  async function run(raw, fuente) {
    msg.hidden = true;
    const domain = normalize(raw);
    if (domain === "") return showMsg("Escriba el dominio de su empresa, por ejemplo suempresa.com.co.");
    if (!domain) return showMsg("Eso no parece un dominio. Escríbalo así: suempresa.com.co, sin http ni www.");
    if (FREE.has(domain)) return showMsg(domain + " es un correo gratuito, no el dominio de su empresa. Escriba lo que va después de la @ en el correo de su empresa.");
    input.value = domain;
    btn.disabled = true;
    btn.textContent = "Revisando…";
    try {
      const [mx, txt, dmarc, dkimMs, dkimG] = await Promise.all([
        query(domain, "MX"), query(domain, "TXT"), query("_dmarc." + domain, "TXT"),
        query("selector1._domainkey." + domain, "CNAME"), query("google._domainkey." + domain, "TXT")
      ]);
      if (mx.Status === 3) return showMsg(domain + " no existe. Revise cómo lo escribió.");
      const res = analyze(mx, txt, dmarc, dkimMs, dkimG);
      current = domain;
      render(domain, res);
      const ref = new URLSearchParams(location.search).get("r") || "";
      send({ tipo: "consulta", dominio: domain, fuente, ref, nivel: res.nivel, puntos: res.puntos,
        plataforma: res.plataforma, spf: res.spf, dmarc: res.dmarc, dkim: res.dkim, mx: res.mx });
    } catch (e) {
      showMsg("No pudimos hacer la revisión en este momento. Intente de nuevo en un minuto, o escríbanos y la hacemos por usted.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Revisar mi dominio";
    }
  }

  form.addEventListener("submit", e => { e.preventDefault(); run(input.value, "formulario"); });
  $$("[data-check]").forEach(b => b.addEventListener("click", () => {
    input.value = b.dataset.check;
    section.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    run(b.dataset.check, "boton");
  }));
  const pre = new URLSearchParams(location.search).get("dominio");
  if (pre) { input.value = pre; section.scrollIntoView(); run(pre, "enlace"); }
})();
