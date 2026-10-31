/*
 * LGERMS storefront — a read-only view of ./catalog.json pushed by
 * scripts/publish-store.mjs. No build step, no framework, no API calls: it only
 * reads the published JSON next to these files and renders it. Keep it that way.
 */
(function () {
  "use strict";

  var DRAFT_KEY = "lgerms.storefront.draft.v1";
  var LANG_KEY = "lgerms.storefront.lang.v1";
  var STALE_MS = 6 * 60 * 60 * 1000; // prices older than 6h are treated as stale
  var MSG_LIMIT = 1500; // keep the WhatsApp text under ~1500 chars

  var NBSP_THIN = "\u202F"; // narrow space for thousand separators

  var MONTHS = {
    sw: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };

  var STR = {
    pageTitle: { sw: "LubhaTech Duka | Bidhaa na Nyaraka", en: "LubhaTech Store | Parts & Handouts" },
    pageDesc: {
      sw: "Omba vipuri, bidhaa na nyaraka za mafunzo kutoka LubhaTech kupitia WhatsApp. Bei na idadi za stock za kisasa.",
      en: "Request spare parts, products and learning handouts from LubhaTech over WhatsApp. Live prices and stock.",
    },
    searchLabel: { sw: "Tafuta", en: "Search" },
    searchPlaceholder: { sw: "Tafuta jina, SKU au kozi", en: "Search name, SKU or course" },
    filterGroupLabel: { sw: "Chuja kundi", en: "Filter group" },
    filterAll: { sw: "Zote", en: "All" },
    filterItems: { sw: "Vipuri", en: "Parts" },
    filterHandouts: { sw: "Nyaraka", en: "Handouts" },
    itemsTitle: { sw: "Vipuri na bidhaa", en: "Parts & products" },
    handoutsTitle: { sw: "Nyaraka za mafunzo", en: "Learning handouts" },
    outOfStock: { sw: "Imetoka", en: "Out of stock" },
    inStockOne: { sw: "kimebaki", en: "left" },
    inStock: { sw: "yamebaki", en: "left" },
    askPrice: { sw: "Bei: uliza kaunta", en: "Price: ask at counter" },
    select: { sw: "Chagua", en: "Select" },
    selected: { sw: "Umechagua", en: "Selected" },
    requestBarTitle: { sw: "Omba bidhaa", en: "Request items" },
    barHint: { sw: "Chagua bidhaa ili kuanza ombi.", en: "Tick items to start a request." },
    viaWhatsApp: { sw: "Omba kwa WhatsApp", en: "Request on WhatsApp" },
    viaPhone: { sw: "Piga simu", en: "Call the shop" },
    clear: { sw: "Futa", en: "Clear" },
    total: { sw: "Jumla", en: "Total" },
    unitOne: { sw: "kitu", en: "item" },
    unitMany: { sw: "vitu", en: "items" },
    counterNote: {
      sw: "Hakuna nambari ya WhatsApp au simu iliyowekwa — tafadhali omba kwenye kaunta.",
      en: "No WhatsApp or phone number is set — please ask at the counter.",
    },
    longNote: {
      sw: "Ombi ni refu mno kutuma kwa simu — chagua idadi ndogo zaidi au omba kwenye kaunta.",
      en: "The request is too long to send by phone — pick fewer items, or ask at the counter.",
    },
    shortNote: { sw: "Ombi limefupishwa kwa urefu.", en: "Message shortened to fit." },
    footerNote: {
      sw: "Ombi hufungua WhatsApp; malipo na nakala za nyaraka huchukuliwa kwenye kaunta.",
      en: "A request opens WhatsApp; payment and handout copies are collected at the counter.",
    },
    emptyTitle: { sw: "Hakuna kilichochapishwa bado", en: "Nothing published yet" },
    emptyBody: {
      sw: "Duka bado halina bidhaa au nyaraka. Rudi hivi karibuni.",
      en: "This store has no items or handouts yet. Please check back soon.",
    },
    noResults: { sw: "Hakuna matokeo ya utafutaji.", en: "No results match your search." },
    loadError: {
      sw: "Hakuna data ya duka (catalog.json). Wasiliana na kaunta.",
      en: "No store data (catalog.json). Please ask at the counter.",
    },
    startsLabel: { sw: "Kuanza", en: "Starts" },
    venueLabel: { sw: "Mahali", en: "Venue" },
    msgHeader: { sw: "Ombi kutoka ukurasa wa", en: "Request from the store page of" },
    msgTotal: { sw: "Jumla", en: "Total" },
    msgFooter: { sw: "Asante.", en: "Thank you." },
    fresh: { sw: "Bei na idadi za stock zasasishwa", en: "Prices and stock updated" },
    freshStale: {
      sw: ", tafadhali thibitisha bei kabla ya kununua",
      en: ", please confirm the price before buying",
    },
    // The shop quotes the price the counter charged, so the customer is told which bill it came from.
    priceOf: { sw: "bei ya", en: "price from" },
    payTitle: { sw: "Njia za malipo", en: "Ways to pay" },
    payMpesa: { sw: "M-Pesa", en: "M-Pesa" },
    payBank: { sw: "Benki (NBC)", en: "Bank (NBC)" },
    payNote: {
      sw: "Malipo hayathibitishi ombi — ombi lithibitishwa na wafanyakazi kwenye kaunta.",
      en: "Paying does not confirm an order — staff at the counter confirm it.",
    },
  };

  var catalog = { shop: {}, currency: "TZS", generatedAt: null, items: [], handouts: [] };
  var lang = loadLang();
  var filter = "all";
  var query = "";
  var draft = loadDraft();
  var index = new Map(); // id -> { kind, data, name, available }

  function t(key) {
    var entry = STR[key];
    if (!entry) return key;
    return entry[lang] != null ? entry[lang] : entry.sw;
  }

  // ---------- storage (never allowed to throw) ----------
  function loadLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v === "en" ? "en" : "sw";
    } catch (e) {
      return "sw";
    }
  }
  function saveLang() {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- money ----------
  // price is a string of shillings, may be null or carry decimals ("12000.50").
  function groupInt(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP_THIN);
  }
  function formatNumber(value) {
    var s = String(value).trim();
    var m = /^(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) return s; // unexpected shape: show as-is rather than invent one
    var int = groupInt(m[1]);
    var dec = m[2] || "";
    var out = int;
    if (dec) {
      if (dec.length === 1) dec = dec + "0";
      if (!/^0+$/.test(dec)) out += "." + dec; // drop meaningless .00 / .000
    }
    return out;
  }
  function toNumber(raw) {
    if (raw == null || raw === "") return null;
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }
  function priceText(raw) {
    var n = toNumber(raw);
    if (n === null) return null;
    return formatNumber(String(raw)) + " " + (catalog.currency || "TZS");
  }

  // ---------- dates ----------
  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function humanDateTime(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return null;
    var m = MONTHS[lang] || MONTHS.sw;
    return d.getDate() + " " + m[d.getMonth()] + " " + d.getFullYear() + ", " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function humanDate(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return null;
    var m = MONTHS[lang] || MONTHS.sw;
    return d.getDate() + " " + m[d.getMonth()] + " " + d.getFullYear();
  }
  function isStale(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return false;
    var age = Date.now() - d.getTime();
    return age > STALE_MS;
  }

  // ---------- localised course name ----------
  function courseName(h) {
    var sw = h.courseNameSw || "";
    var en = h.courseName || "";
    return lang === "sw" ? sw || en : en || sw;
  }

  // ---------- dom helper ----------
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- build the item/handout index ----------
  function buildIndex() {
    index = new Map();
    var items = Array.isArray(catalog.items) ? catalog.items : [];
    var handouts = Array.isArray(catalog.handouts) ? catalog.handouts : [];
    items.forEach(function (it) {
      if (it && it.id) index.set(it.id, { kind: "item", data: it, name: it.name || it.sku || "", available: num(it.available) });
    });
    handouts.forEach(function (h) {
      if (h && h.id) index.set(h.id, { kind: "handout", data: h, name: h.title || courseName(h) || "", available: num(h.available) });
    });
    // prune ticks that no longer exist or are out of stock
    var changed = false;
    Object.keys(draft).forEach(function (id) {
      var entry = index.get(id);
      if (!entry || entry.available <= 0) {
        delete draft[id];
        changed = true;
      } else if (draft[id] > entry.available) {
        draft[id] = entry.available;
        changed = true;
      }
    });
    if (changed) saveDraft();
  }
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  // ---------- stock label ----------
  function stockLabel(available) {
    if (available <= 0) return t("outOfStock");
    return available + " " + (available === 1 ? t("inStockOne") : t("inStock"));
  }

  // ---------- card ----------
  function card(entry) {
    var d = entry.data;
    var available = entry.available;
    var out = available <= 0;
    var selected = draft[d.id] != null;

    var card = el("article", "card" + (out ? " is-out" : ""));
    card.setAttribute("data-id", d.id);
    card.setAttribute("data-kind", entry.kind);

    var top = el("div", "card-top");
    var name = el("h3", "card-name", entry.name);
    top.appendChild(name);
    var p = priceText(d.price);
    if (p) {
      top.appendChild(el("span", "price", p));
      // The line was written at one price and cut by a discount: show the old figure struck through.
      var list = priceText(d.listPrice);
      if (list && list !== p) top.appendChild(el("s", "price-old", list));
    } else {
      top.appendChild(el("span", "price ask", t("askPrice")));
    }
    var pricedOn = d.priceDate ? humanDate(d.priceDate) : null;
    if (pricedOn) top.appendChild(el("span", "price-when", t("priceOf") + " " + pricedOn));
    card.appendChild(top);

    if (entry.kind === "item") {
      var subBits = [];
      if (d.sku) subBits.push(d.sku);
      if (d.unit) subBits.push(d.unit);
      card.appendChild(el("p", "card-sub", subBits.join(" · ")));
      if (d.description) card.appendChild(el("p", "card-desc", d.description));
    } else {
      var course = courseName(d);
      var metaBits = [];
      if (course) metaBits.push(course);
      if (d.sessionCode) metaBits.push(d.sessionCode);
      card.appendChild(el("p", "card-sub", metaBits.join(" · ")));
      var lineBits = [];
      var when = humanDate(d.startsAt);
      if (when) lineBits.push(t("startsLabel") + ": " + when);
      if (d.venue) lineBits.push(t("venueLabel") + ": " + d.venue);
      if (lineBits.length) card.appendChild(el("p", "card-desc", lineBits.join(" · ")));
    }

    // badges: out-of-stock is text + a dash mark, never colour alone
    var badges = el("div", "badges");
    if (entry.kind === "handout" && d.mimeType && String(d.mimeType).toLowerCase().indexOf("pdf") !== -1) {
      badges.appendChild(el("span", "chip pdf", "PDF"));
    }
    badges.appendChild(el("span", "chip " + (out ? "out" : "stock"), stockLabel(available)));
    card.appendChild(badges);

    // select + quantity
    var row = el("div", "select-row");
    var toggle = el("label", "select-toggle" + (out ? " is-disabled" : ""));
    var cb = el("input", "sel-input");
    cb.type = "checkbox";
    cb.setAttribute("data-id", d.id);
    cb.setAttribute("aria-label", entry.name);
    cb.disabled = out;
    cb.checked = selected && !out;
    toggle.appendChild(cb);
    var selText = el("span", "sel-text", out ? t("outOfStock") : selected ? t("selected") : t("select"));
    toggle.appendChild(selText);
    row.appendChild(toggle);
    card.appendChild(row);

    if (!out) {
      var qty = el("div", "qty");
      qty.setAttribute("data-id", d.id);
      if (!selected) qty.hidden = true;
      var minus = el("button", "qty-btn");
      minus.type = "button";
      minus.textContent = "\u2212"; // minus sign
      minus.setAttribute("data-act", "dec");
      minus.setAttribute("data-id", d.id);
      minus.setAttribute("aria-label", lang === "sw" ? "Punguza" : "Decrease");
      var val = el("span", "qty-value", selected ? String(draft[d.id]) : "1");
      val.setAttribute("data-id", d.id);
      var plus = el("button", "qty-btn");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("data-act", "inc");
      plus.setAttribute("data-id", d.id);
      plus.setAttribute("aria-label", lang === "sw" ? "Ongeza" : "Increase");
      qty.appendChild(minus);
      qty.appendChild(val);
      qty.appendChild(plus);
      row.appendChild(qty);
    }
    return card;
  }

  // ---------- render catalog ----------
  function renderCatalog() {
    var host = document.getElementById("catalog");
    var status = document.getElementById("status");
    host.innerHTML = "";
    status.textContent = "";

    var items = Array.isArray(catalog.items) ? catalog.items : [];
    var handouts = Array.isArray(catalog.handouts) ? catalog.handouts : [];

    if (!items.length && !handouts.length) {
      var empty = el("div", "empty");
      empty.appendChild(el("h2", null, t("emptyTitle")));
      empty.appendChild(el("p", null, t("emptyBody")));
      host.appendChild(empty);
      return;
    }

    var q = query.trim().toLowerCase();
    var showItems = filter === "all" || filter === "items";
    var showHandouts = filter === "all" || filter === "handouts";
    var renderedAny = false;
    var matchedAny = false;

    if (showItems) {
      var list = items.filter(function (it) {
        return matches(it, q, "item");
      });
      if (list.length) matchedAny = true;
      if (list.length) {
        host.appendChild(el("h2", "section-title", t("itemsTitle")));
        var grid = el("div", "grid");
        list.forEach(function (it) {
          var entry = index.get(it.id);
          if (entry) {
            grid.appendChild(card(entry));
            renderedAny = true;
          }
        });
        host.appendChild(grid);
      }
    }

    if (showHandouts) {
      var hlist = handouts.filter(function (h) {
        return matches(h, q, "handout");
      });
      if (hlist.length) matchedAny = true;
      if (hlist.length) {
        host.appendChild(el("h2", "section-title", t("handoutsTitle")));
        var hgrid = el("div", "grid");
        hlist.forEach(function (h) {
          var entry = index.get(h.id);
          if (entry) {
            hgrid.appendChild(card(entry));
            renderedAny = true;
          }
        });
        host.appendChild(hgrid);
      }
    }

    if (!renderedAny) {
      status.textContent = t("noResults");
    } else if (matchedAny && q) {
      status.textContent = "";
    }
  }

  function matches(d, q, kind) {
    if (!q) return true;
    var hay = [];
    if (kind === "item") {
      hay.push(d.name, d.sku, d.description);
    } else {
      hay.push(d.title, d.courseName, d.courseNameSw, d.sessionCode);
    }
    return hay
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .indexOf(q) !== -1;
  }

  // ---------- in-place control updates ----------
  function updateCardControls(id) {
    var entry = index.get(id);
    if (!entry || entry.available <= 0) return;
    var card = document.querySelector('.card[data-id="' + cssAttr(id) + '"]');
    if (!card) return;
    var cb = card.querySelector(".sel-input");
    var qty = card.querySelector(".qty");
    var val = card.querySelector(".qty-value");
    var selText = card.querySelector(".sel-text");
    var minus = card.querySelector('[data-act="dec"]');
    var plus = card.querySelector('[data-act="inc"]');
    var selected = draft[id] != null;
    if (cb) cb.checked = selected;
    if (selText) selText.textContent = selected ? t("selected") : t("select");
    if (qty) qty.hidden = !selected;
    if (selected) {
      var n = draft[id];
      if (val) val.textContent = String(n);
      if (minus) minus.disabled = n <= 1;
      if (plus) plus.disabled = n >= entry.available;
    }
  }
  function cssAttr(s) {
    return String(s).replace(/"/g, '\\"');
  }

  // ---------- request bar ----------
  function selectedRows() {
    var rows = [];
    Object.keys(draft).forEach(function (id) {
      var entry = index.get(id);
      if (!entry || entry.available <= 0) return;
      var d = entry.data;
      var qty = draft[id];
      var ref = entry.kind === "item" ? d.sku : d.sessionCode;
      rows.push({
        kind: entry.kind,
        name: entry.name,
        ref: ref || "",
        qty: qty,
        price: d.price,
        priceNum: toNumber(d.price),
      });
    });
    return rows;
  }

  function totalText(rows) {
    var sum = 0;
    rows.forEach(function (r) {
      if (r.priceNum != null) sum += r.priceNum * r.qty;
    });
    var rounded = Math.round(sum * 100) / 100;
    return formatNumber(rounded.toFixed(2)) + " " + (catalog.currency || "TZS");
  }

  function composeMessage(rows, compact) {
    var shop = catalog.shop && catalog.shop.name ? catalog.shop.name : "LubhaTech";
    var lines = [];
    lines.push(t("msgHeader") + " " + shop + ":");
    rows.forEach(function (r) {
      var head = r.qty + " x " + r.name;
      if (!compact && r.ref) head += " (" + r.ref + ")";
      if (!compact) {
        var pr = priceText(r.price);
        head += " — " + (pr || t("askPrice"));
      }
      lines.push(head);
    });
    lines.push(t("msgTotal") + ": " + totalText(rows));
    lines.push(t("msgFooter"));
    return lines.join("\n");
  }

  function whatsappUrl(text) {
    var digits = String((catalog.shop && catalog.shop.whatsapp) || "").replace(/\D/g, "");
    if (!digits) return null;
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
  }
  function telUrl() {
    var phone = String((catalog.shop && catalog.shop.phone) || "").replace(/[^\d+]/g, "");
    var hasDigits = /[0-9]/.test(phone);
    if (!hasDigits) return null;
    return "tel:" + phone;
  }

  function renderBar() {
    var bar = document.getElementById("requestBar");
    var summary = document.getElementById("requestSummary");
    var note = document.getElementById("requestNote");
    var actions = document.getElementById("requestActions");
    bar.hidden = false;
    actions.innerHTML = "";
    note.hidden = true;
    note.textContent = "";

    var rows = selectedRows();

    if (!rows.length) {
      summary.textContent = t("barHint");
      var hasContact = whatsappUrl("x") || telUrl();
      if (!hasContact) {
        note.hidden = false;
        note.textContent = t("counterNote");
      }
      return;
    }

    // summary: count + total, built from nodes (no innerHTML from data)
    summary.innerHTML = "";
    var count = rows.reduce(function (a, r) {
      return a + r.qty;
    }, 0);
    summary.appendChild(
      el("span", null, count + " " + (count === 1 ? t("unitOne") : t("unitMany")) + " · ")
    );
    summary.appendChild(el("span", "total", t("total") + ": " + totalText(rows)));

    var message = composeMessage(rows, false);
    var useCompact = false;
    if (message.length > MSG_LIMIT) {
      message = composeMessage(rows, true);
      useCompact = true;
    }

    var wa = whatsappUrl(message);
    var tel = telUrl();

    if (message.length > MSG_LIMIT) {
      // Even the short form would arrive cut off, so say so instead of sending half an order.
      note.hidden = false;
      note.textContent = t("longNote");
    } else if (wa || tel) {
      var a = el("a", "btn btn-request", wa ? t("viaWhatsApp") : t("viaPhone"));
      a.href = wa || tel;
      if (wa) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      actions.appendChild(a);
      // A phone call carries no text, so only a shortened WhatsApp message is worth mentioning.
      if (wa && useCompact) {
        note.hidden = false;
        note.textContent = t("shortNote");
      }
    } else {
      // no contact: never render a dead link, show a counter note instead
      note.hidden = false;
      note.textContent = t("counterNote");
    }

    var clear = el("button", "btn btn-clear", t("clear"));
    clear.type = "button";
    clear.id = "clearBtn";
    clear.addEventListener("click", function () {
      var ids = Object.keys(draft);
      ids.forEach(function (id) {
        delete draft[id];
      });
      saveDraft();
      ids.forEach(updateCardControls);
      renderBar();
    });
    actions.appendChild(clear);
  }

  // ---------- freshness ----------
  function renderFreshness() {
    var p = document.getElementById("freshness");
    var iso = catalog.generatedAt;
    var when = humanDateTime(iso);
    if (!when) {
      p.hidden = true;
      return;
    }
    var stale = isStale(iso);
    p.hidden = false;
    p.className = "freshness" + (stale ? " is-stale" : "");
    p.textContent = t("fresh") + " " + when + (stale ? t("freshStale") : "");
  }

  // ---------- header & static i18n ----------
  function renderChrome() {
    document.documentElement.lang = lang;
    document.title = t("pageTitle");
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("pageDesc"));

    var shop = catalog.shop || {};
    document.getElementById("shopName").textContent = shop.name || "LubhaTech";
    document.getElementById("shopAddress").textContent = shop.address || "";

    // Payment instructions are printed, never verified — so an unset number leaves the block hidden
    // rather than showing a customer an account to send money to that does not exist.
    var payBox = document.getElementById("payBox");
    var payList = document.getElementById("payList");
    var ways = [];
    if (shop.mpesa) ways.push([t("payMpesa"), shop.mpesa]);
    if (shop.bank) ways.push([t("payBank"), shop.bank]);
    payList.textContent = "";
    ways.forEach(function (way) {
      var li = el("li", "pay-row");
      li.appendChild(el("span", "pay-kind", way[0]));
      li.appendChild(el("span", "pay-num", way[1]));
      payList.appendChild(li);
    });
    payBox.hidden = ways.length === 0;

    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (n) {
      n.setAttribute("placeholder", t(n.getAttribute("data-i18n-ph")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (n) {
      n.setAttribute("aria-label", t(n.getAttribute("data-i18n-aria")));
    });
    document.getElementById("langSw").classList.toggle("is-active", lang === "sw");
    document.getElementById("langEn").classList.toggle("is-active", lang === "en");
    document.getElementById("search").value = query;

    var fbtns = document.querySelectorAll(".filter-btn");
    fbtns.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-filter") === filter);
    });
  }

  function renderAll() {
    renderChrome();
    renderFreshness();
    renderCatalog();
    renderBar();
  }

  // ---------- events ----------
  function wireEvents() {
    document.getElementById("search").addEventListener("input", function (e) {
      query = e.target.value || "";
      renderCatalog();
    });

    document.querySelectorAll(".filter-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        filter = b.getAttribute("data-filter");
        renderChrome();
        renderCatalog();
      });
    });

    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-lang");
        if (next === lang) return;
        lang = next === "en" ? "en" : "sw";
        saveLang();
        renderAll();
      });
    });

    // delegated clicks: toggles handled on change, steppers on click
    var host = document.getElementById("catalog");
    host.addEventListener("change", function (e) {
      var cb = e.target.closest(".sel-input");
      if (!cb) return;
      var id = cb.getAttribute("data-id");
      var entry = index.get(id);
      if (!entry || entry.available <= 0) return;
      if (cb.checked) {
        draft[id] = 1;
      } else {
        delete draft[id];
      }
      saveDraft();
      updateCardControls(id);
      renderBar();
    });
    host.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      var entry = index.get(id);
      if (!entry || draft[id] == null) return;
      var n = draft[id];
      if (act === "inc") n = Math.min(entry.available, n + 1);
      if (act === "dec") n = Math.max(1, n - 1);
      draft[id] = n;
      saveDraft();
      updateCardControls(id);
      renderBar();
    });
  }

  // ---------- boot ----------
  function boot() {
    wireEvents();
    fetch("./catalog.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        catalog = data && typeof data === "object" ? data : catalog;
        if (!catalog.shop) catalog.shop = {};
        if (!Array.isArray(catalog.items)) catalog.items = [];
        if (!Array.isArray(catalog.handouts)) catalog.handouts = [];
        buildIndex();
        renderAll();
      })
      .catch(function () {
        catalog.items = [];
        catalog.handouts = [];
        buildIndex();
        renderChrome();
        var p = document.getElementById("freshness");
        p.hidden = true;
        document.getElementById("status").textContent = t("loadError");
        renderCatalog();
        renderBar();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
