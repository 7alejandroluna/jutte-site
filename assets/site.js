(() => {
  "use strict";

  /* Settings */
  const API = "https://jutte-consultas.azurewebsites.net/api/consulta";
  const WHATSAPP = "573165215117";
  const MAIL = "contact@jutte.co";
  const BOOKINGS = "https://bookings.cloud.microsoft/book/JutteBookings@jutte.co/";  /* Microsoft Bookings page */
  const POLICY_VERSION = "2026-11-27";

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

  /* Calls to the Jutte endpoint. text/plain keeps it a simple request (no CORS preflight). */
  async function post(payload, opts = {}) {
    if (!API) throw new Error("no-api");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 25000);
    try {
      const r = await fetch(API, {
        method: "POST", mode: "cors", keepalive: !!opts.keepalive, referrerPolicy: "no-referrer",
        signal: ctrl.signal, headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(Object.assign({ pagina: location.pathname }, payload))
      });
      let data = {};
      try { data = await r.json(); } catch (e) { /* empty or non-JSON body */ }
      return { status: r.status, data };
    } finally { clearTimeout(timer); }
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(text, href, cls, external) {
    const a = el("a", cls, text);
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }

  /* Shared validation */
  const FREE = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
    "live.com", "live.com.mx", "msn.com", "yahoo.com", "yahoo.es", "ymail.com", "icloud.com", "me.com", "aol.com",
    "protonmail.com", "proton.me", "gmx.com", "zoho.com", "une.net.co", "etb.net.co"]);
  const EMAIL_RE = /^[^\s@]+@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63})$/i;
  const domainOf = email => { const m = EMAIL_RE.exec(email); return m ? m[1].toLowerCase() : null; };
  const phoneOk = v => { const d = v.replace(/\D/g, ""); return d.length >= 7 && d.length <= 15 && !/[^\d\s+().-]/.test(v); };

  /* Contact page form */
  $$("form[data-lead=contacto]").forEach(form => {
    const pick = { correo: "Protección de correo", diagnostico: "Diagnóstico de Microsoft 365", blindaje: "Blindaje de Microsoft 365",
      vigilancia: "Plan Vigilancia", chequeo: "Revisión de correo" }[new URLSearchParams(location.search).get("servicio")];
    if (pick && form.elements.servicio) form.elements.servicio.value = pick;
    const err = $(".msg", form);
    const done = $(".done", form.parentElement);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      const nombre = (data.nombre || "").trim();
      const correo = (data.correo || "").trim();
      const whatsapp = (data.whatsapp || "").trim();
      const fail = t => { err.textContent = t; err.hidden = false; };
      if (!nombre) return fail("Escriba su nombre.");
      if (!domainOf(correo)) return fail("Revise su correo. Debe verse así: nombre@suempresa.com.co.");
      if (!phoneOk(whatsapp)) return fail("Revise su WhatsApp. Escriba el número completo, por ejemplo 300 123 4567.");
      if (!form.elements.consentimiento.checked) return fail("Para responderle necesitamos su autorización para usar estos datos.");
      const payload = {
        tipo: "contacto", nombre, correo, whatsapp, empresa: (data.empresa || "").trim(),
        servicio: data.servicio || "", mensaje: (data.mensaje || "").trim(),
        consentimiento: true, politica: POLICY_VERSION, jt_confirm: data.jt_confirm || ""
      };
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      btn.textContent = "Enviando…";
      let ok = false;
      try { ok = (await post(payload)).status === 200; } catch (x) { ok = false; }
      btn.disabled = false;
      btn.textContent = "Enviar mensaje";
      form.hidden = true;
      if (ok) {
        done.replaceChildren(el("p", null, "Recibido, " + nombre + ". Le respondemos a " + correo + " el mismo día hábil o el siguiente."));
        done.hidden = false;
        return;
      }
      const lines = ["Hola, soy " + nombre + " (" + correo + ", " + whatsapp + ")."];
      if (payload.empresa) lines.push("Empresa: " + payload.empresa + ".");
      if (payload.servicio) lines.push("Me interesa: " + payload.servicio + ".");
      if (payload.mensaje) lines.push(payload.mensaje);
      const text = lines.join("\n");
      const row = el("div", "form-actions");
      row.append(link("Enviar por WhatsApp", wa(text), "btn btn-green", true),
        link("Enviar por correo", "mailto:" + MAIL + "?subject=" + encodeURIComponent("Contacto: " + (payload.empresa || nombre)) + "&body=" + encodeURIComponent(text), "btn btn-line"));
      done.replaceChildren(el("p", null, "Gracias, " + nombre + ". No pudimos enviar el formulario en este momento. Envíenos su mensaje por uno de estos medios:"), row);
      done.hidden = false;
    });
  });

  /* Free email check: contact details first, then the result */
  const form = $("#check");
  if (!form) return;
  const emailIn = $("#c-correo");
  const waIn = $("#c-wa");
  const btn = $("#check-btn");
  const msg = $("#check-msg");
  const out = $("#result");
  const section = $("#revisar");
  const params = new URLSearchParams(location.search);
  const ref = (params.get("r") || "").slice(0, 60);

  const PLANS = {
    correo: { name: "Protección de correo", price: "$890.000", unit: "por dominio, pago único",
      text: "Corregimos lo que encontramos para que nadie pueda enviar correos en nombre de su empresa.", href: "servicios.html#correo" },
    diagnostico: { name: "Diagnóstico de Microsoft 365", price: "Desde $1.600.000", unit: "en un solo pago",
      text: "Revisamos cuentas, accesos, archivos y equipos, y le entregamos un plan claro de 30 días.", href: "servicios.html#diagnostico" },
    vigilancia: { name: "Plan Vigilancia", price: "Desde $450.000", unit: "al mes",
      text: "Cada mes confirmamos que su correo siga protegido y le avisamos si alguien intenta usar su dominio.", href: "servicios.html#vigilancia" }
  };
  const planFor = res => res.nivel !== "bajo" ? "correo" : res.plataforma === "microsoft365" ? "diagnostico" : "vigilancia";

  const COPY = {
    alto: { label: "Riesgo alto", title: d => "Hoy cualquiera podría enviar correos en nombre de " + d + ".",
      sub: "Y llegarían a la bandeja de entrada de sus clientes y de su propio equipo, sin ninguna advertencia." },
    medio: { label: "Riesgo medio", title: d => d + " está protegido, pero no del todo.",
      sub: "Algunos correos falsos en su nombre todavía podrían llegar a sus clientes o a su equipo." },
    bajo: { label: "Riesgo bajo", title: d => "El correo de " + d + " está bien protegido en lo básico.",
      sub: "El siguiente riesgo suele estar en las cuentas: contraseñas, accesos y administradores." }
  };

  const ERRORS = {
    correo: () => "Revise su correo. Debe verse así: nombre@suempresa.com.co.",
    gratuito: () => "Ese es un correo personal (Gmail, Hotmail y similares). Escriba el correo de su empresa para revisar su dominio.",
    whatsapp: () => "Revise su WhatsApp. Escriba el número completo, por ejemplo 300 123 4567.",
    consentimiento: () => "Para enviarle el resultado necesitamos su autorización para usar estos datos.",
    dominio: d => "No encontramos el dominio " + (d || "de su correo") + ". Revise cómo escribió su correo.",
    limite: () => "Hizo varias revisiones seguidas. Intente de nuevo en unos minutos."
  };

  function showMsg(text, withWhatsApp) {
    msg.replaceChildren(document.createTextNode(text));
    if (withWhatsApp) {
      msg.append(" ", link("Escríbanos por WhatsApp", wa("Hola, quiero la revisión gratis del correo de mi empresa" +
        (emailIn.value.trim() ? " (" + emailIn.value.trim() + ")" : "") + "."), null, true), " y la hacemos por usted.");
    }
    msg.hidden = false;
  }

  function render(res, demo) {
    const c = COPY[res.nivel];
    out.replaceChildren();
    out.classList.remove("reveal");
    out.append(el("span", "level level-" + res.nivel, c.label));
    out.append(el("h2", null, c.title(res.dominio)));
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

    if (demo) {
      const note = el("p", "sent", "Este es el resultado de jutte.co. Para ver el de su empresa, escriba su correo y su WhatsApp en el formulario.");
      out.append(note);
    } else {
      const plan = PLANS[planFor(res)];
      const offer = el("div", "offer");
      offer.append(el("p", "offer-k", "Le recomendamos"), el("h3", null, plan.name));
      const price = el("p", "offer-price");
      price.append(el("strong", null, plan.price), document.createTextNode(" " + plan.unit));
      offer.append(price, el("p", null, plan.text));
      const actions = el("div", "offer-actions");
      actions.append(link("Ver qué incluye", plan.href, "btn btn-green"),
        link("Hablar por WhatsApp", wa("Hola, hice la revisión de " + res.dominio + " en jutte.co y quiero hablar sobre el resultado."), "btn btn-line", true));
      if (BOOKINGS) actions.append(link("Agendar 20 minutos", BOOKINGS, "link-arrow", true));
      offer.append(actions);
      out.append(offer);
      out.append(el("p", "sent", res.correoEnviado
        ? "También le enviamos este resultado a " + res.correo + "."
        : "Guardamos su resultado. Le escribiremos a " + res.correo + " con los detalles."));
      const again = el("button", "link-arrow again", "Revisar otro correo");
      again.type = "button";
      again.addEventListener("click", () => { out.hidden = true; form.hidden = false; emailIn.focus(); });
      out.append(again);
      form.hidden = true;
    }
    out.hidden = false;
    void out.offsetWidth;
    out.classList.add("reveal");
  }

  async function check() {
    msg.hidden = true;
    const correo = emailIn.value.trim().toLowerCase();
    const whatsapp = waIn.value.trim();
    const domain = domainOf(correo);
    if (!domain) return showMsg(ERRORS.correo());
    if (FREE.has(domain)) return showMsg(ERRORS.gratuito());
    if (!phoneOk(whatsapp)) return showMsg(ERRORS.whatsapp());
    if (!form.elements.consentimiento.checked) return showMsg(ERRORS.consentimiento());
    btn.disabled = true;
    btn.textContent = "Revisando " + domain + "…";
    try {
      const { status, data } = await post({
        tipo: "revision", correo, whatsapp, consentimiento: true, politica: POLICY_VERSION,
        ref, fuente: ref ? "enlace" : "formulario", jt_confirm: form.elements.jt_confirm.value || ""
      });
      if (status === 200 && data && data.ok && COPY[data.nivel]) {
        render(Object.assign({ correo }, data), false);
        out.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      } else if (data && ERRORS[data.error]) {
        showMsg(ERRORS[data.error](data.dominio));
      } else {
        showMsg("No pudimos completar la revisión en este momento.", true);
      }
    } catch (e) {
      showMsg("No pudimos completar la revisión en este momento.", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Ver mi resultado";
    }
  }

  async function demo() {
    section.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    msg.hidden = true;
    try {
      const { status, data } = await post({ tipo: "demo" });
      if (status === 200 && data && data.ok && COPY[data.nivel]) render(data, true);
      else showMsg("No pudimos mostrar el ejemplo en este momento. Intente de nuevo en un minuto.");
    } catch (e) {
      showMsg("No pudimos mostrar el ejemplo en este momento. Intente de nuevo en un minuto.");
    }
  }

  form.addEventListener("submit", e => { e.preventDefault(); check(); });
  $$("[data-demo]").forEach(b => b.addEventListener("click", demo));

  /* Arrivals from an outreach link: ?dominio=firma.com&r=code */
  const pre = (params.get("dominio") || "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 120);
  if (pre) {
    emailIn.placeholder = "nombre@" + pre;
    section.scrollIntoView();
    post({ tipo: "visita", dominio: pre, ref }, { keepalive: true, timeout: 10000 }).catch(() => {});
  }
  if (params.get("demo")) demo();
})();
