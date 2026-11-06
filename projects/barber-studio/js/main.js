/* =========================================================
   Hartley & Vane — Barbers
   Vanilla JS, no dependencies. Every feature is a small,
   self-contained init function called at the bottom.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Shop data (edit here) ---------- */

  const SHOP_TZ = "Europe/London";

  // Opening hours by JS weekday (0 = Sunday). null = closed. Times are 24h decimals.
  const HOURS = {
    0: { open: 10, close: 15 },
    1: null,
    2: { open: 9, close: 18 },
    3: { open: 9, close: 18 },
    4: { open: 9, close: 20 },
    5: { open: 9, close: 20 },
    6: { open: 8, close: 17 },
  };
  const LAST_BOOKING_BUFFER = 0.75; // last appointment 45 minutes before closing
  const SLOT_STEP = 0.5;            // 30-minute slots
  const BOOKING_WINDOW_DAYS = 28;

  const BARBERS = {
    any: "First available",
    callum: "Callum Hartley",
    dele: "Dele Vane",
    tomasz: "Tomasz Wilk",
  };

  const SERVICES = [
    {
      group: "Haircuts",
      items: [
        { id: "signature", name: "Signature haircut", price: 32, mins: 45,
          desc: "Our standard cut. Consultation, wash, precision cut with clippers and scissors, hot towel on the neck, and styling.",
          includes: ["Consultation", "Wash", "Neck shave", "Styling"] },
        { id: "scissor", name: "Scissor cut, longer hair", price: 36, mins: 60,
          desc: "Scissor-only cutting for longer and layered styles, with extra time to get the weight and shape right.",
          includes: ["Consultation", "Wash", "Blow-dry", "Styling"] },
        { id: "junior", name: "Junior cut", price: 20, mins: 30,
          desc: "For under-12s. Patient, quick and tidy. A parent or guardian must stay in the shop.",
          includes: ["Under 12", "Styling"] },
      ],
    },
    {
      group: "Fades",
      items: [
        { id: "skinfade", name: "Skin fade", price: 30, mins: 45,
          desc: "Fade down to the skin, blended by hand with foil shavers and detailed with a razor line-up.",
          includes: ["Foil finish", "Razor line-up", "Styling"] },
        { id: "taper", name: "Low or mid taper", price: 28, mins: 40,
          desc: "A softer, more conservative taper that keeps a little length at the sides and grows out cleanly.",
          includes: ["Clipper and scissor", "Neck tidy", "Styling"] },
        { id: "fadetop", name: "Fade top-up", price: 18, mins: 20,
          desc: "Sides and back refreshed within three weeks of a fade with us. Top left as it is.",
          includes: ["Within 3 weeks", "Sides and back"] },
      ],
    },
    {
      group: "Beards and shaves",
      items: [
        { id: "beard", name: "Beard shape and trim", price: 18, mins: 30,
          desc: "Length taken down, shape defined, cheek and neck lines cut in with a straight razor, finished with beard oil.",
          includes: ["Razor lines", "Hot towel", "Beard oil"] },
        { id: "shave", name: "Hot towel shave", price: 34, mins: 45,
          desc: "The traditional wet shave. Pre-shave oil, two hot towels, a lathered straight-razor shave and a cold towel to close.",
          includes: ["Two hot towels", "Straight razor", "Cold towel", "Balm"] },
        { id: "headshave", name: "Head shave", price: 24, mins: 30,
          desc: "A smooth razor head shave with hot towel preparation and a soothing balm afterwards.",
          includes: ["Hot towel", "Straight razor", "Balm"] },
      ],
    },
    {
      group: "Packages",
      items: [
        { id: "fullhartley", name: "The Full Hartley", price: 58, mins: 75,
          desc: "Signature haircut, beard shape or hot towel shave, and a face massage. Our most-booked appointment before weddings and interviews.",
          includes: ["Signature cut", "Beard or shave", "Face massage"] },
        { id: "fadebeard", name: "Fade and beard", price: 44, mins: 60,
          desc: "A skin fade and a beard shape in one appointment, blended so the two meet cleanly.",
          includes: ["Skin fade", "Beard trim", "Hot towel"] },
        { id: "fatherson", name: "Father and son", price: 48, mins: 75,
          desc: "A signature haircut and a junior cut back to back, booked with the same barber.",
          includes: ["Adult cut", "Junior cut", "Same barber"] },
      ],
    },
  ];

  const ALL_SERVICES = SERVICES.flatMap((g) => g.items);
  const findService = (id) => ALL_SERVICES.find((s) => s.id === id);

  /* ---------- Helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const formatPrice = (n) => "£" + n;
  const formatMins = (m) => {
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} hr ${r} min` : `${h} hr`;
  };
  const formatTime = (dec) => {
    const h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  // Current date/time in the shop's time zone, whatever the visitor's zone.
  function shopNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hour = Number(get("hour")) % 24;
    return {
      isoDate: `${get("year")}-${get("month")}-${get("day")}`,
      weekday: days[get("weekday")],
      decimal: hour + Number(get("minute")) / 60,
    };
  }

  // Parse YYYY-MM-DD as a calendar date (no time-zone drift).
  function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  function addDays(iso, n) {
    const d = parseISODate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function weekdayOf(iso) { return parseISODate(iso).getUTCDay(); }
  function formatLongDate(iso) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    }).format(parseISODate(iso));
  }

  // Small deterministic hash so the demo's "already booked" slots look
  // realistic but stay the same each time you pick the same day.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  let toastTimer;
  function toast(message) {
    const el = $("[data-toast]");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function scrollToEl(el) {
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  /* ---------- Header and navigation ---------- */

  function initHeader() {
    const header = $("[data-header]");
    if (!header) return;
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initMobileNav() {
    const toggle = $("[data-nav-toggle]");
    const menu = $("[data-nav-menu]");
    if (!toggle || !menu) return;
    const mq = window.matchMedia("(max-width: 960px)");

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      $(".nav-toggle-label", toggle).textContent = open ? "Close" : "Menu";
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("no-scroll", open);
    };

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setOpen(open);
      if (open) { const first = $("a", menu); if (first) first.focus(); }
    });

    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Close if the viewport grows past the mobile breakpoint.
    mq.addEventListener("change", (e) => { if (!e.matches) setOpen(false); });
  }

  // Highlight the nav link for the section in view.
  function initActiveLinks() {
    const links = $$('.nav-menu a[href^="#"]:not(.btn)');
    const map = new Map();
    links.forEach((a) => {
      const id = a.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (section) map.set(section, a);
    });
    if (!("IntersectionObserver" in window) || !map.size) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.removeAttribute("aria-current"));
        const link = map.get(entry.target);
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    map.forEach((_, section) => io.observe(section));
  }

  /* ---------- Opening hours ---------- */

  function initHours() {
    const now = shopNow();
    const today = HOURS[now.weekday];

    // Highlight today's row in the hours table.
    $$("[data-hours-table] tr").forEach((row) => {
      row.classList.toggle("is-today", Number(row.dataset.day) === now.weekday);
    });

    // Live open/closed line in the hero.
    const status = $("[data-open-status]");
    if (!status) return;
    let text;
    let open = false;
    if (today && now.decimal >= today.open && now.decimal < today.close) {
      open = true;
      text = `Open now until ${formatTime(today.close)}`;
    } else {
      // Find the next opening.
      for (let i = 0; i < 8; i++) {
        const day = (now.weekday + i) % 7;
        const h = HOURS[day];
        if (!h) continue;
        if (i === 0 && now.decimal >= h.open) continue;
        const label = i === 0 ? "today" : i === 1 ? "tomorrow" :
          new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" })
            .format(parseISODate(addDays(now.isoDate, i)));
        text = `Closed now. Opens ${label} at ${formatTime(h.open)}`;
        break;
      }
    }
    status.textContent = text;
    status.classList.toggle("is-open", open);
  }

  /* ---------- Services tariff ---------- */

  function initTariff() {
    const root = $("[data-tariff]");
    if (!root) return;

    const html = SERVICES.map((group, gi) => `
      <div class="tariff-group">
        <h3 class="tariff-group-title">${group.group}</h3>
        <ul>
          ${group.items.map((s) => `
            <li class="tariff-item" data-service="${s.id}">
              <button class="tariff-row" type="button" aria-expanded="false" aria-controls="svc-${s.id}">
                <span class="tariff-name">${s.name}</span>
                <span class="tariff-leader" aria-hidden="true"></span>
                <span class="tariff-price">${formatPrice(s.price)}</span>
                <span class="tariff-icon" aria-hidden="true"></span>
                <span class="tariff-meta">${formatMins(s.mins)}</span>
              </button>
              <div class="tariff-detail" id="svc-${s.id}" role="region" aria-label="${s.name} details" inert>
                <div>
                  <div class="tariff-detail-inner">
                    <p>${s.desc}</p>
                    <ul class="tariff-includes" aria-label="Included">
                      ${s.includes.map((i) => `<li>${i}</li>`).join("")}
                    </ul>
                    <a class="btn btn-ghost" href="#book" data-book-service="${s.id}">Book ${s.name.toLowerCase()}</a>
                  </div>
                </div>
              </div>
            </li>`).join("")}
        </ul>
      </div>`).join("");

    root.innerHTML = html;

    root.addEventListener("click", (e) => {
      const row = e.target.closest(".tariff-row");
      if (!row) return;
      const item = row.closest(".tariff-item");
      const open = row.getAttribute("aria-expanded") !== "true";
      row.setAttribute("aria-expanded", String(open));
      item.classList.toggle("is-open", open);
      // Collapsed details stay out of the tab order and accessibility tree.
      $(".tariff-detail", item).inert = !open;
    });
  }

  /* ---------- Booking (front-end demo only) ---------- */

  function initBooking() {
    const form = $("[data-booking-form]");
    if (!form) return;

    const serviceWrap = $("[data-service-choices]", form);
    const dateInput = $("#bk-date", form);
    const slotsWrap = $("[data-time-slots]", form);
    const result = $("[data-demo-result]");
    const resultList = $("[data-result-list]");
    const sum = (key) => $(`[data-sum="${key}"]`);

    // Render service radio cards from the shared data.
    serviceWrap.innerHTML = ALL_SERVICES.map((s) => `
      <label class="choice">
        <input type="radio" name="service" value="${s.id}">
        <span class="choice-name">${s.name}</span>
        <span class="choice-price">${formatPrice(s.price)}</span>
        <span class="choice-time">${formatMins(s.mins)}</span>
      </label>`).join("");

    // Date limits, based on the shop's local date.
    const now = shopNow();
    dateInput.min = now.isoDate;
    dateInput.max = addDays(now.isoDate, BOOKING_WINDOW_DAYS);

    const getValue = (name) => {
      const el = form.elements[name];
      if (!el) return "";
      if (el instanceof RadioNodeList) return el.value;
      return el.value.trim();
    };

    function setError(field, message) {
      const msg = $(`[data-error-for="${field}"]`, form);
      const input = form.elements[field];
      if (msg) { msg.textContent = message || ""; msg.hidden = !message; }
      if (input && !(input instanceof RadioNodeList)) {
        if (message) {
          input.setAttribute("aria-invalid", "true");
          if (msg) { msg.id = `err-${field}`; input.setAttribute("aria-errormessage", msg.id); }
        } else {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-errormessage");
        }
      }
    }

    function dateProblem(iso) {
      if (!iso) return "Choose a date for your appointment.";
      if (iso < dateInput.min) return "Choose today or a later date.";
      if (iso > dateInput.max) return `Bookings open up to ${BOOKING_WINDOW_DAYS} days ahead. Choose an earlier date.`;
      if (!HOURS[weekdayOf(iso)]) return "We're closed on Mondays. Choose another day.";
      return "";
    }

    function renderSlots() {
      const iso = dateInput.value;
      const service = findService(getValue("service"));
      const barber = getValue("barber") || "any";
      const previous = getValue("time");
      const problem = iso ? dateProblem(iso) : "";

      if (!iso || problem) {
        slotsWrap.innerHTML = `<p class="time-empty">${problem || "Choose a date to see available times."}</p>`;
        if (iso) setError("date", problem);
        return;
      }
      setError("date", "");

      const hours = HOURS[weekdayOf(iso)];
      const length = service ? service.mins / 60 : 0.5;
      const last = Math.min(hours.close - LAST_BOOKING_BUFFER, hours.close - length);
      const isToday = iso === shopNow().isoDate;
      const nowDec = shopNow().decimal;

      const slots = [];
      for (let t = hours.open; t <= last + 1e-9; t += SLOT_STEP) {
        const label = formatTime(t);
        // Demo availability: a stable pseudo-random ~30% of slots look taken.
        // "First available" sees fewer taken slots, as it pools all barbers.
        const seed = hash(`${iso}|${barber}|${label}`) % 100;
        const taken = barber === "any" ? seed < 12 : seed < 32;
        const past = isToday && t <= nowDec + 0.5;
        slots.push({ label, disabled: taken || past });
      }

      if (!slots.some((s) => !s.disabled)) {
        slotsWrap.innerHTML = `<p class="time-empty">No times left on this day. Try another date or choose "First available".</p>`;
        return;
      }

      slotsWrap.innerHTML = slots.map((s) => `
        <label class="chip">
          <input type="radio" name="time" value="${s.label}" ${s.disabled ? "disabled" : ""} ${(!s.disabled && s.label === previous) ? "checked" : ""}>
          <span>${s.label}</span>
        </label>`).join("");
    }

    function updateSummary() {
      const service = findService(getValue("service"));
      const barber = getValue("barber") || "any";
      const iso = dateInput.value;
      const time = getValue("time");

      sum("service").textContent = service ? service.name : "Not chosen yet";
      sum("barber").textContent = BARBERS[barber];
      sum("date").textContent = iso && !dateProblem(iso) ? formatLongDate(iso) : "Not chosen yet";
      sum("time").textContent = time || "Not chosen yet";
      sum("duration").textContent = service ? formatMins(service.mins) : "–";
      sum("price").textContent = service ? formatPrice(service.price) : "–";
    }

    function validate() {
      const errors = {};
      if (!getValue("service")) errors.service = "Choose a service.";
      const dp = dateProblem(dateInput.value);
      if (dp) errors.date = dp;
      else if (!getValue("time")) errors.time = "Choose a time.";
      if (getValue("name").length < 2) errors.name = "Enter your name.";
      const phone = getValue("phone").replace(/[\s()-]/g, "");
      if (!/^(\+44|0)\d{9,10}$/.test(phone)) errors.phone = "Enter a UK phone number, for example 07700 900123.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(getValue("email"))) errors.email = "Enter an email address, for example name@example.com.";

      ["service", "date", "time", "name", "phone", "email"].forEach((f) => setError(f, errors[f]));
      return errors;
    }

    form.addEventListener("change", (e) => {
      const name = e.target.name;
      if (name === "service" || name === "barber" || name === "date") renderSlots();
      if (name === "service") setError("service", "");
      if (name === "time") setError("time", "");
      updateSummary();
    });
    dateInput.addEventListener("input", () => { renderSlots(); updateSummary(); });

    // Clear a text field's error as soon as the user corrects it.
    ["name", "phone", "email"].forEach((f) => {
      form.elements[f].addEventListener("input", () => {
        if (form.elements[f].getAttribute("aria-invalid") === "true") setError(f, "");
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const errors = validate();
      const first = Object.keys(errors)[0];
      if (first) {
        const target = first === "service" ? $("input[name=service]", form)
          : first === "time" ? (slotsWrap.querySelector("input:not(:disabled)") || dateInput)
          : form.elements[first];
        if (target) {
          (target.closest(".field-group") || target).scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
          target.focus({ preventScroll: true });
        }
        return;
      }

      // Show the demo preview. Nothing is sent anywhere.
      const service = findService(getValue("service"));
      const rows = [
        ["Service", `${service.name} (${formatMins(service.mins)})`],
        ["Barber", BARBERS[getValue("barber") || "any"]],
        ["When", `${formatLongDate(dateInput.value)} at ${getValue("time")}`],
        ["Price", formatPrice(service.price)],
        ["Name", getValue("name")],
        ["Mobile", getValue("phone")],
        ["Email", getValue("email")],
      ];
      if (getValue("notes")) rows.push(["Notes", getValue("notes")]);

      resultList.innerHTML = "";
      rows.forEach(([k, v]) => {
        const div = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = k;
        dd.textContent = v; // textContent: user input is never injected as HTML
        div.append(dt, dd);
        resultList.append(div);
      });
      result.hidden = false;
      scrollToEl(result);
      result.focus({ preventScroll: true });
    });

    $("[data-result-edit]").addEventListener("click", () => {
      result.hidden = true;
      scrollToEl(form);
      form.elements.name.focus({ preventScroll: true });
    });

    $("[data-result-reset]").addEventListener("click", () => {
      form.reset();
      result.hidden = true;
      ["service", "date", "time", "name", "phone", "email"].forEach((f) => setError(f, ""));
      renderSlots();
      updateSummary();
      scrollToEl(form.closest("section"));
    });

    // Public helpers so other parts of the page can pre-fill the form.
    form.selectService = (id) => {
      const input = $(`input[name=service][value="${id}"]`, form);
      if (input) { input.checked = true; setError("service", ""); renderSlots(); updateSummary(); }
    };
    form.selectBarber = (id) => {
      const input = $(`input[name=barber][value="${id}"]`, form);
      if (input) { input.checked = true; renderSlots(); updateSummary(); }
    };

    updateSummary();
  }

  // "Book this service" and "Book with …" links pre-fill the form.
  function initPrefillLinks() {
    const form = $("[data-booking-form]");
    if (!form) return;
    document.addEventListener("click", (e) => {
      const svc = e.target.closest("[data-book-service]");
      const brb = e.target.closest("[data-book-barber]");
      if (svc && form.selectService) {
        form.selectService(svc.dataset.bookService);
        toast(`${findService(svc.dataset.bookService).name} selected. Now choose a barber and time.`);
      }
      if (brb && form.selectBarber) {
        form.selectBarber(brb.dataset.bookBarber);
        toast(`${BARBERS[brb.dataset.bookBarber]} selected.`);
      }
    });
  }

  /* ---------- Gallery lightbox ---------- */

  function initLightbox() {
    const gallery = $("[data-gallery]");
    const box = $("[data-lightbox]");
    if (!gallery || !box) return;

    const items = $$(".g-item", gallery);
    const img = $("[data-lb-img]", box);
    const caption = $("[data-lb-caption]", box);
    const closeBtn = $("[data-lb-close]", box);
    let index = 0;
    let lastFocus = null;

    function show(i) {
      index = (i + items.length) % items.length;
      const thumb = $("img", items[index]);
      img.src = items[index].dataset.full;
      img.alt = thumb.alt;
      caption.textContent = `${thumb.alt} (${index + 1} of ${items.length})`;
      // Warm the cache for the neighbours so arrows feel instant.
      [index - 1, index + 1].forEach((n) => {
        const it = items[(n + items.length) % items.length];
        const pre = new Image();
        pre.src = it.dataset.full;
      });
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.hidden = false;
      document.body.classList.add("no-scroll");
      requestAnimationFrame(() => box.classList.add("is-visible"));
      closeBtn.focus();
    }

    function close() {
      box.classList.remove("is-visible");
      document.body.classList.remove("no-scroll");
      const done = () => { box.hidden = true; img.removeAttribute("src"); };
      if (prefersReducedMotion) done(); else setTimeout(done, 250);
      if (lastFocus) lastFocus.focus();
    }

    items.forEach((btn, i) => {
      const alt = $("img", btn).alt;
      btn.setAttribute("aria-label", `View larger: ${alt}`);
      btn.addEventListener("click", () => open(i));
    });

    closeBtn.addEventListener("click", close);
    $("[data-lb-prev]", box).addEventListener("click", () => show(index - 1));
    $("[data-lb-next]", box).addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });

    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key === "ArrowRight") show(index + 1);
      else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const focusables = $$("button", box);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Basic swipe support on touch screens.
    let startX = null;
    box.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ---------- Small extras ---------- */

  function initDemoLinks() {
    $$("[data-demo-link]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        toast("Social links are placeholders in this portfolio concept.");
      });
    });
  }

  function initYear() {
    const el = $("[data-year]");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- Start ---------- */
  initHeader();
  initMobileNav();
  initActiveLinks();
  initHours();
  initTariff();
  initBooking();
  initPrefillLinks();
  initLightbox();
  initDemoLinks();
  initYear();
})();
