/*
 * LGERMS customer tracking page — reads ./track/<token>.json, one file per job,
 * pushed by scripts/publish-store.mjs. There is no index to browse: holding one
 * link shows one job. The shop words (name, WhatsApp, phone) come from ./catalog.json.
 * No build step, no framework, no API calls. Keep it that way.
 */
(function () {
  "use strict";

  var LANG_KEY = "lgerms.storefront.lang.v1";
  var STALE_MS = 6 * 60 * 60 * 1000;
  var TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var NBSP_THIN = "\u202F";

  var MONTHS = {
    sw: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };

  var STR = {
    pageTitle: { sw: "Fuatilia urekebishaji | LubhaTech", en: "Track your repair | LubhaTech" },
    pageTitleShort: { sw: "Fuatilia urekebishaji", en: "Track your repair" },
    pageDesc: {
      sw: "Angalia hali ya urekebishaji wa kifaa chako karakani kwa kutumia kiungo au nambari uliyopewa.",
      en: "Check the progress of a repair at the workshop with the link or code you were given.",
    },
    refLabel: { sw: "Namba ya kazi", en: "Job reference" },
    deviceLabel: { sw: "Kifaa", en: "Device" },
    receivedLabel: { sw: "Ilipokelewa karakani", en: "Received at the workshop" },
    deliveredLabel: { sw: "Ilikabidhiwa", en: "Handed back" },
    updatedLabel: { sw: "Hali ilisasishwa", en: "Status updated" },
    updatedStale: {
      sw: " — hali hii inaweza kuwa ya zamani, thibitisha kwa mtu wa kaunta",
      en: " — this may be out of date, please confirm with the counter",
    },
    timelineTitle: { sw: "Hatua zilizopita", en: "What has happened" },
    estimateTitle: { sw: "Kadri ya gharama", en: "Estimate" },
    estimateTotal: { sw: "Jumla ya kadri", en: "Estimated total" },
    estimateIssued: {
      sw: "Kadri hii bado haijathibitishwa na mteja — gharama ya mwisho inaweza kubadilika.",
      en: "This quote is not yet approved by you — the final cost may change.",
    },
    estimateApproved: {
      sw: "Kadri imethibitishwa. Gharama ya mwisho inathibitishwa kwenye kaunta.",
      en: "The quote is approved. The counter confirms the final cost.",
    },
    estimateValidUntil: { sw: "Halisi hadi", en: "Valid until" },
    noEstimate: {
      sw: "Hakuna kadri iliyotolewa bado. Kaunta itakujulisha baada ya ukaguzi.",
      en: "No quote has been issued yet. The counter will tell you after the inspection.",
    },
    askTitle: { sw: "Uliza kuhusu kazi hii", en: "Ask about this job" },
    askMsg: {
      sw: "Swali kuhusu kazi ya urekebishaji namba",
      en: "A question about repair job",
    },
    askFrom: { sw: "kutoka ukurasa wa kufuatilia.", en: "from the tracking page." },
    viaPhone: { sw: "Piga simu", en: "Call the shop" },
    counterNote: {
      sw: "Hakuna nambari ya WhatsApp au simu iliyowekwa — tafadhali ulize kwenye kaunta.",
      en: "No WhatsApp or phone number is set — please ask at the counter.",
    },
    pasteLabel: { sw: "Kiungo au nambari ya kufuatilia", en: "Tracking link or code" },
    pastePlaceholder: {
      sw: "mchoro: https://…/track.html?t=… au a1b2c3d4-…",
      en: "e.g. https://…/track.html?t=… or a1b2c3d4-…",
    },
    pasteHint: {
      sw: "Weka kiungo kamili kutoka kwenye nkarisho uliyopewa karakani, au nambari yake pekee.",
      en: "Paste the full link printed on your workshop slip, or just the code from it.",
    },
    pasteBtn: { sw: "Fungua", en: "Open" },
    badCode: {
      sw: "Nambari hiyo si ya kufuatilia. Tafadhali weka kiungo kamili kutoka kwenye nkarisho.",
      en: "That is not a tracking code. Please paste the full link from your slip.",
    },
    notFoundTitle: { sw: "Hakuna kazi hiyo", en: "We cannot find that job" },
    notFoundBody: {
      sw: "Kiungo hiki hakiionyeshi kazi yoyote. Kazi inaweza kuwa ilikabidhiwa muda mrefu uliopita, au nambari si sahihi. Ulize mtu wa kaunta.",
      en: "This link shows no job. The repair may have been handed back a long time ago, or the code is wrong. Please ask at the counter.",
    },
    loadError: {
      sw: "Hatuwezi kupata hali ya sasa. Jaribu tena, au ulize mtu wa kaunta.",
      en: "We cannot load the latest information. Try again or ask at the counter.",
    },
    backToShop: { sw: "Rudi kwenye duka", en: "Back to the store" },
    trackFooter: {
      sw: "Taarifa hizi ni nakili kutoka kwenye rekodi za karakana na zisasishwa mara kwa mara — thibitisha mabadiliko makubwa kwa mtu wa kaunta.",
      en: "This is a mirror of the workshop records and is refreshed periodically — confirm big changes at the counter.",
    },
  };

  var shop = {};
  var currency = "TZS";
  var lang = loadLang();
  var token = null;
  var job = null;
  var badCode = false;

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

  // ---------- money & dates ----------
  function groupInt(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP_THIN);
  }
  function formatNumber(value) {
    var s = String(value).trim();
    var m = /^(\d+)(?:\.(\d+))?$/.exec(s);
    if (!m) return s;
    var int = groupInt(m[1]);
    var dec = m[2] || "";
    var out = int;
    if (dec) {
      if (dec.length === 1) dec = dec + "0";
      if (!/^0+$/.test(dec)) out += "." + dec;
    }
    return out;
  }
  function toNumber(raw) {
    if (raw == null || raw === "") return null;
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }
  function money(raw) {
    var n = toNumber(raw);
    if (n === null) return null;
    return formatNumber(String(raw)) + " " + (currency || "TZS");
  }
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
    return Date.now() - d.getTime() > STALE_MS;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- the code ----------
  // Accepts a bare UUID or a whole pasted link; only a validated UUID ever reaches the file name.
  function extractToken(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    if (TOKEN_RE.test(s)) return s.toLowerCase();
    var m = /[?&#]t=([0-9a-f-]{36})/i.exec(s);
    if (m && TOKEN_RE.test(m[1])) return m[1].toLowerCase();
    return null;
  }
  function tokenFromUrl() {
    var params = new URLSearchParams(window.location.search || "");
    return extractToken(params.get("t")) || extractToken((window.location.hash || "").replace(/^#/, ""));
  }

  // ---------- contact ----------
  function whatsappUrl(text) {
    var digits = String(shop.whatsapp || "").replace(/\D/g, "");
    if (!digits) return null;
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
  }
  function telUrl() {
    var phone = String(shop.phone || "").replace(/[^\d+]/g, "");
    if (!/[0-9]/.test(phone)) return null;
    return "tel:" + phone;
  }

  // ---------- rendering ----------
  function deviceText(d) {
    if (!d) return null;
    var category = lang === "sw" ? d.categorySw || d.categoryEn : d.categoryEn || d.categorySw;
    var bits = [];
    if (category) bits.push(category);
    if (d.brand) bits.push(d.brand);
    if (d.model) bits.push(d.model);
    return bits.length ? bits.join(" ") : null;
  }

  function stateNode(cls) {
    var box = el("div", "track-state " + (cls || ""));
    box.appendChild(el("p", "track-state-label", lang === "sw" ? job.stateSw || job.state : job.stateEn || job.state));
    var when = humanDateTime(job.updatedAt);
    if (when) {
      var stale = isStale(job.updatedAt);
      box.appendChild(el("p", "track-state-when", t("updatedLabel") + ": " + when + (stale ? t("updatedStale") : "")));
    }
    return box;
  }

  function estimateNode() {
    var e = job.estimate;
    if (!e) {
      var none = el("div", "estimate");
      none.appendChild(el("p", "estimate-note", t("noEstimate")));
      return none;
    }
    var box = el("div", "estimate");
    box.appendChild(el("p", "estimate-label", t("estimateTitle")));
    var total = money(e.total);
    if (total) box.appendChild(el("p", "estimate-total", t("estimateTotal") + ": " + total));
    var note = e.status === "APPROVED" ? t("estimateApproved") : t("estimateIssued");
    box.appendChild(el("p", "estimate-note", note));
    var valid = humanDate(e.validUntil);
    if (valid) box.appendChild(el("p", "estimate-note", t("estimateValidUntil") + ": " + valid));
    return box;
  }

  function timelineNode() {
    var steps = Array.isArray(job.timeline) ? job.timeline : [];
    // The API sends oldest first; the customer reads newest first.
    var ordered = steps.slice().reverse();
    if (!ordered.length) return null;
    var box = el("div", "card track-card");
    box.appendChild(el("h2", "section-title", t("timelineTitle")));
    var list = el("ol", "timeline");
    ordered.forEach(function (step, i) {
      var li = el("li", "tl-step" + (i === 0 ? " is-first" : ""));
      li.appendChild(el("span", "tl-dot"));
      li.appendChild(el("p", "tl-state", lang === "sw" ? step.stateSw || step.state : step.stateEn || step.state));
      var when = humanDateTime(step.at);
      if (when) li.appendChild(el("p", "tl-when", when));
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  function actionsNode() {
    var box = el("div", "track-actions");
    var msg = t("askMsg") + " " + (job.ref || "") + " " + t("askFrom");
    var wa = whatsappUrl(msg);
    var tel = telUrl();
    if (wa || tel) {
      var a = el("a", "btn btn-request", wa ? t("askTitle") : t("viaPhone"));
      a.href = wa || tel;
      if (wa) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      box.appendChild(a);
    } else {
      box.appendChild(el("p", "card-note", t("counterNote")));
    }
    return box;
  }

  function factRow(label, value) {
    if (!value) return null;
    var p = el("p", "card-desc");
    p.appendChild(el("strong", null, label + ": "));
    p.appendChild(document.createTextNode(value));
    return p;
  }

  function renderJob() {
    var host = document.getElementById("trackBody");
    host.innerHTML = "";

    var done = job.state === "DELIVERED";
    var blocked = job.state === "UNREPAIRABLE" || job.state === "CANCELLED";
    host.appendChild(stateNode(done ? "is-done" : blocked ? "is-blocked" : ""));
    host.appendChild(estimateNode());

    var card = el("div", "card track-card");
    // The reference already stands in the heading above; the card carries what the customer asked about.
    var dev = factRow(t("deviceLabel"), deviceText(job.device));
    var rec = factRow(t("receivedLabel"), humanDateTime(job.receivedAt));
    var dlv = factRow(t("deliveredLabel"), humanDateTime(job.deliveredAt));
    [dev, rec, dlv].forEach(function (n) {
      if (n) card.appendChild(n);
    });
    if (card.childNodes.length) host.appendChild(card);

    var tl = timelineNode();
    if (tl) host.appendChild(tl);
    host.appendChild(actionsNode());
  }

  function showMessage(titleKey, bodyKey) {
    var host = document.getElementById("trackBody");
    host.innerHTML = "";
    var box = el("div", "empty");
    box.appendChild(el("h2", null, t(titleKey)));
    box.appendChild(el("p", null, t(bodyKey)));
    host.appendChild(box);
  }

  function renderChrome() {
    document.documentElement.lang = lang;
    document.title = t("pageTitle");
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("pageDesc"));

    document.getElementById("shopName").textContent = shop.name || "LubhaTech";
    document.getElementById("shopAddress").textContent = shop.address || "";
    document.getElementById("trackTitle").textContent = t("pageTitleShort");
    document.getElementById("trackRef").textContent = job && job.ref ? t("refLabel") + ": " + job.ref : "";

    var p = document.getElementById("freshness");
    var when = humanDateTime(job ? job.generatedAt : null);
    if (!when) {
      p.hidden = true;
    } else {
      p.hidden = false;
      var stale = isStale(job.generatedAt);
      p.className = "freshness" + (stale ? " is-stale" : "");
      p.textContent = t("updatedLabel") + " " + when + (stale ? t("updatedStale") : "");
    }

    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (n) {
      n.setAttribute("placeholder", t(n.getAttribute("data-i18n-ph")));
    });
    document.getElementById("langSw").classList.toggle("is-active", lang === "sw");
    document.getElementById("langEn").classList.toggle("is-active", lang === "en");

    var form = document.getElementById("trackForm");
    form.hidden = !!job;
    var err = document.getElementById("codeError");
    if (job) {
      err.hidden = true;
      err.textContent = "";
    }
  }

  function renderAll() {
    renderChrome();
    if (job) renderJob();
    else if (token) showMessage("notFoundTitle", "notFoundBody");
    // No code in the address at all: the form above is the invitation, so the body stays empty.
    else document.getElementById("trackBody").innerHTML = "";
  }

  // ---------- loading ----------
  function getJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function loadShop() {
    return getJson("./catalog.json")
      .then(function (data) {
        if (data && typeof data === "object") {
          shop = data.shop && typeof data.shop === "object" ? data.shop : {};
          currency = data.currency || "TZS";
        }
      })
      .catch(function () {
        /* the tracking file alone is enough; the shop words simply stay defaults */
      });
  }

  function loadJob(next) {
    token = next;
    job = null;
    badCode = false;
    var err = document.getElementById("codeError");
    err.hidden = true;
    err.textContent = "";
    renderChrome();

    if (!token) {
      renderAll();
      return;
    }
    getJson("./track/" + token + ".json")
      .then(function (data) {
        if (!data || typeof data !== "object" || !data.code) {
          showMessage("notFoundTitle", "notFoundBody");
          renderChrome();
          return;
        }
        // The file that answered must be the one this address asked for — never show someone else's job.
        if (extractToken(data.code) !== token) {
          showMessage("notFoundTitle", "notFoundBody");
          renderChrome();
          return;
        }
        job = data;
        currency = data.currency || currency;
        renderChrome();
        renderJob();
      })
      .catch(function () {
        showMessage("notFoundTitle", "notFoundBody");
        renderChrome();
      });
  }

  // ---------- events ----------
  function wireEvents() {
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-lang");
        if (next === lang) return;
        lang = next === "en" ? "en" : "sw";
        saveLang();
        renderAll();
      });
    });

    document.getElementById("trackForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("trackCode");
      var value = input && input.value ? input.value : "";
      var found = extractToken(value);
      var err = document.getElementById("codeError");
      if (!found) {
        badCode = true;
        err.hidden = false;
        err.textContent = t("badCode");
        return;
      }
      // Rewriting the address keeps the page shareable and reloadable from the same link.
      try {
        window.history.replaceState(null, "", window.location.pathname + "?t=" + found);
      } catch (e2) {
        /* ignore */
      }
      loadJob(found);
    });
  }

  function boot() {
    wireEvents();
    token = tokenFromUrl();
    renderChrome();
    loadShop().then(function () {
      renderChrome();
      loadJob(token);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
