/*
 * LGERMS customer tracking page — reads ./track/<token>.json, one file per job,
 * pushed by scripts/publish-store.mjs. There is no index to browse: holding one
 * link shows one job. The shop words (name, WhatsApp, phone) come from ./catalog.json.
 * No build step, no framework. Reading stays a file fetch; a customer's own answer
 * goes to ./catalog.json's shop.api when the workshop has published a public https
 * address there, and to WhatsApp when it has not. Nothing else is ever uploaded.
 */
(function () {
  "use strict";

  var LANG_KEY = "lgerms.storefront.lang.v1";
  var NAME_KEY = "lgerms.storefront.name.v1";
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
    answerTitle: { sw: "Majibu yako", en: "Your answers" },
    answerIntro: {
      sw: "Vitufe hivi haviungi bei wala hatua ya kazi — vinasema tu jibu lako kwa kazi hii.",
      en: "These buttons change no price and no step of the job — they only carry your answer for this job.",
    },
    nameLabel: { sw: "Jina lako", en: "Your name" },
    nameHint: {
      sw: "Jina hili ndilo litakaandikwa kwenye rekodi ya kazi hii.",
      en: "This is the name the workshop writes on this job's record.",
    },
    nameMissing: {
      sw: "Andika jina lako kwanza (angalau herufi 2).",
      en: "Write your name first (at least 2 letters).",
    },
    quoteAck: { sw: "Nimeipokea nukuu hii", en: "I have received this quotation" },
    quoteAccept: { sw: "Nakubali", en: "I accept this price" },
    quoteDecline: { sw: "Nakataa", en: "I decline this price" },
    deviceAck: { sw: "Nimechukua kifaa changu", en: "I have collected my device" },
    feedbackTitle: { sw: "Maoni yako", en: "Your opinion" },
    feedbackRating: { sw: "Unipa nambari ngapi?", en: "What rating would you give it?" },
    feedbackMessage: { sw: "Maoni yako (herufi 3 au zaidi)", en: "Your words (3 characters or more)" },
    feedbackSend: { sw: "Tuma maoni", en: "Send your opinion" },
    feedbackShort: {
      sw: "Andika maoni yako (herufi 3 au zaidi).",
      en: "Write your words (3 characters or more).",
    },
    ratingNone: { sw: "Bila nambari", en: "No rating" },
    answerSent: {
      sw: "Jibu lako limefikia karakana.",
      en: "The workshop has received your answer.",
    },
    answerAlready: {
      sw: "Umetuma jibu hili tayari — karakana limepokea.",
      en: "You have already sent this answer — the workshop has it.",
    },
    answerOffline: {
      sw: "Karakana bado haijapanga njia ya kujibu mtandaoni, kwa hivyo kitufe hiki kinafungua WhatsApp uandikie kaunta. Jibu lako hapo halishikiliwi kwenye mfumo hadi mtu wa kaunta aliandike.",
      en: "This workshop has not set up an online answer path, so this button opens WhatsApp for you to write to the counter. Nothing is recorded until the counter types it in.",
    },
    sendFailed: {
      sw: "Jibu lako halijafikia karakana. Jaribu tena, au tumia WhatsApp / ulize kaunta.",
      en: "Your answer did not reach the workshop. Try again, or use WhatsApp / ask at the counter.",
    },
    busy: { sw: "Inatuma…", en: "Sending…" },
    errorByCode: {
      NO_OPEN_QUOTATION: {
        sw: "Hakuna nukuu inayosubiri jibu lako kwa kazi hii.",
        en: "There is no quotation waiting for your answer on this job.",
      },
      QUOTE_ALREADY_DECIDED: {
        sw: "Nukuu hii tayari imepata jibu. Badilisha jibu kwa kuuliza kaunta.",
        en: "This quotation already has an answer. Ask the counter to change it.",
      },
      QUOTE_EXPIRED: {
        sw: "Nukuu hii imeisha muda wake. Kaunta itatoa mpya.",
        en: "This quotation has expired. The counter will issue a new one.",
      },
      QUOTE_JOB_STATE: {
        sw: "Kazi hii haisubiri jibu la mteja sasa. Ulize kaunta.",
        en: "This job is not waiting for a customer answer right now. Ask the counter.",
      },
      TRACKING_CLOSED: {
        sw: "Kazi hii imefungwa kwa majibu ya mteja.",
        en: "This job is closed to customer answers.",
      },
      NO_QUOTATION_YET: {
        sw: "Hakuna nukuu iliyotolewa bado kwa kazi hii.",
        en: "No quotation has been issued for this job yet.",
      },
      DEVICE_NOT_HANDED_BACK: {
        sw: "Karakana bado haijarekodi kuukabidhi kifaa huu.",
        en: "The workshop has not recorded handing this device back.",
      },
      TOO_MANY_REQUESTS: {
        sw: "Majaribio mengi kwa dakika moja. Subiri kidogo kisha ujaribu tena.",
        en: "Too many tries in one minute. Wait a moment and try again.",
      },
    },
    waAccept: { sw: "Nakubali", en: "I accept" },
    waDecline: { sw: "Nakataa", en: "I decline" },
    waQuoteAck: { sw: "Nimeipokea", en: "I have received" },
    waDeviceAck: { sw: "Nimechukua kifaa changu", en: "I have collected my device" },
    waQuote: { sw: "nukuu ya", en: "the quotation of" },
    waJob: { sw: "kwa kazi", en: "for job" },
    waName: { sw: "Jina", en: "Name" },
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
  var customerName = loadName();
  /** Answers this page has already landed, keyed by control. The published file lags minutes behind a tap. */
  var sent = {};

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
  function loadName() {
    try {
      return String(localStorage.getItem(NAME_KEY) || "");
    } catch (e) {
      return "";
    }
  }
  function saveName() {
    try {
      localStorage.setItem(NAME_KEY, customerName);
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

  // ---------- the customer's own answers ----------
  // A customer's words leave this page only for an https address the workshop itself published in
  // ./catalog.json. Anything else — a plain http LAN address, a half-typed value — is refused here,
  // because an answer about a price must not travel in the open.
  function apiBase() {
    var raw = String(shop.api || "").trim();
    if (!/^https:\/\/[^\s]+$/i.test(raw)) return null;
    return raw.replace(/\/+$/, "");
  }

  /** Resolves with the server's reply; rejects with the one code the customer is told about. */
  function postAnswer(path, body) {
    var url = apiBase() + "/store/jobs/" + encodeURIComponent(token) + "/" + path;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = null;
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = null;
          }
          if (r.ok) return data || {};
          var err = new Error("answer " + (data && data.code ? data.code : r.status));
          err.answerCode = data && data.code ? String(data.code) : "SEND_FAILED";
          throw err;
        });
      })
      .catch(function (err) {
        throw err && err.answerCode ? err.answerCode : "SEND_FAILED";
      });
  }

  function errorText(code) {
    // Only the codes the shop is known to answer with; anything else gets the plain "it did not arrive".
    if (!Object.prototype.hasOwnProperty.call(STR.errorByCode, code)) return t("sendFailed");
    var entry = STR.errorByCode[code];
    return entry[lang] != null ? entry[lang] : entry.sw;
  }

  function trimmedName() {
    return String(customerName || "").trim();
  }
  // The server refuses a name under two characters; saying so here saves the customer a round trip.
  function nameOk() {
    return trimmedName().length >= 2;
  }

  function waAnswerText(shortLabel) {
    var parts = [shortLabel, t("waJob") + " " + (job.ref || "")];
    if (trimmedName()) parts.push(t("waName") + ": " + trimmedName());
    return parts.join(" — ");
  }

  /**
   * The one path an answer takes: check the name, disable the button, then the server's own words on a
   * refusal. `makeBody` returns the body, or a sentence to show the customer when what they typed is short.
   */
  function sendAnswer(id, button, status, path, makeBody) {
    function show(cls, text) {
      status.hidden = false;
      status.className = cls;
      status.textContent = text;
    }
    button.addEventListener("click", function () {
      if (sent[id]) return;
      if (!nameOk()) {
        show("track-error", t("nameMissing"));
        return;
      }
      var body = makeBody();
      if (typeof body === "string") {
        show("track-error", body);
        return;
      }
      button.disabled = true;
      show("track-hint", t("busy"));
      postAnswer(path, body).then(
        function () {
          sent[id] = true;
          button.disabled = true;
          show("answer-ok", t("answerSent"));
        },
        function (code) {
          button.disabled = false;
          show("track-error", errorText(code));
        },
      );
    });
  }

  function answerButton(label, soft) {
    var b = el("button", "btn " + (soft ? "btn-soft" : "btn-request"), label);
    b.type = "button";
    return b;
  }

  /** One answer, one row: a button into the shop's API, or a WhatsApp link when there is no API. */
  function answerRow(id, label, path, makeBody, waShort, soft) {
    var row = el("div", "answer-row");
    if (sent[id]) {
      row.appendChild(el("p", "answer-ok", t("answerAlready")));
      return row;
    }
    if (apiBase()) {
      var btn = answerButton(label, soft);
      var status = el("p", "track-hint");
      status.hidden = true;
      row.appendChild(btn);
      row.appendChild(status);
      sendAnswer(id, btn, status, path, makeBody);
      return row;
    }
    var wa = whatsappUrl(waAnswerText(waShort));
    if (!wa) {
      row.appendChild(el("p", "card-note", t("counterNote")));
      return row;
    }
    var a = el("a", "btn " + (soft ? "btn-soft" : "btn-request"), label);
    a.href = wa;
    a.target = "_blank";
    a.rel = "noopener";
    row.appendChild(a);
    return row;
  }

  function nameField() {
    var field = el("div", "track-field");
    var label = el("label", null, t("nameLabel"));
    var input = el("input");
    label.setAttribute("for", "answerName");
    input.type = "text";
    input.id = "answerName";
    input.name = "name";
    input.autocomplete = "name";
    input.value = customerName;
    input.addEventListener("input", function () {
      customerName = input.value;
      saveName();
    });
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(el("p", "track-hint", t("nameHint")));
    return field;
  }

  function feedbackNode() {
    var block = el("div", "answer-block");
    block.appendChild(el("p", "estimate-label", t("feedbackTitle")));
    if (sent.feedback) {
      block.appendChild(el("p", "answer-ok", t("answerAlready")));
      return block;
    }
    if (apiBase()) {
      var rating = el("select");
      rating.id = "answerRating";
      var none = el("option", null, t("ratingNone"));
      none.value = "";
      rating.appendChild(none);
      [5, 4, 3, 2, 1].forEach(function (n) {
        var o = el("option", null, n + "/5");
        o.value = String(n);
        rating.appendChild(o);
      });
      var words = el("textarea");
      words.id = "answerWords";
      words.rows = 3;
      words.maxLength = 1000;
      var rLabel = el("label", null, t("feedbackRating"));
      rLabel.setAttribute("for", "answerRating");
      var wLabel = el("label", null, t("feedbackMessage"));
      wLabel.setAttribute("for", "answerWords");
      var btn = answerButton(t("feedbackSend"), false);
      var status = el("p", "track-hint");
      status.hidden = true;
      block.appendChild(rLabel);
      block.appendChild(rating);
      block.appendChild(wLabel);
      block.appendChild(words);
      block.appendChild(btn);
      block.appendChild(status);
      sendAnswer("feedback", btn, status, "feedback", function () {
        var message = words.value.trim();
        if (message.length < 3) return t("feedbackShort");
        var body = { name: trimmedName(), message: message };
        var score = toNumber(rating.value);
        if (score !== null) body.rating = score;
        return body;
      });
      return block;
    }
    var wa = whatsappUrl(waAnswerText(t("feedbackTitle")));
    if (!wa) {
      block.appendChild(el("p", "card-note", t("counterNote")));
      return block;
    }
    var row = el("div", "answer-row");
    var a = el("a", "btn btn-request", t("feedbackSend"));
    a.href = wa;
    a.target = "_blank";
    a.rel = "noopener";
    row.appendChild(a);
    block.appendChild(row);
    return block;
  }

  /**
   * What a customer may answer is the published state talking, not the button: an accept only stands beside
   * a quotation that is still issued on a job still waiting for that answer, and a collection only after the
   * workshop recorded handing the device back. The server checks all of it again — this only avoids offering
   * a button that is known to be refused.
   */
  function answersNode() {
    var estimate = job.estimate;
    var canDecide = job.state === "AWAITING_CUSTOMER_APPROVAL" && !!estimate && estimate.status === "ISSUED";
    var delivered = job.state === "DELIVERED";
    if (!estimate && !delivered) return null;

    var box = el("div", "card track-card answers-card");
    box.appendChild(el("h2", "section-title", t("answerTitle")));
    box.appendChild(el("p", "card-desc", t("answerIntro")));
    if (!apiBase()) box.appendChild(el("p", "card-note", t("answerOffline")));
    box.appendChild(nameField());
    if (estimate) {
      box.appendChild(
        answerRow(
          "quoteAck",
          t("quoteAck"),
          "receipt",
          function () {
            return { kind: "QUOTE_RECEIVED", name: trimmedName() };
          },
          t("waQuoteAck"),
          true,
        ),
      );
    }
    if (canDecide) {
      box.appendChild(
        answerRow(
          "accept",
          t("quoteAccept"),
          "quote-decision",
          function () {
            return { decision: "APPROVED", name: trimmedName() };
          },
          t("waAccept"),
          false,
        ),
      );
      box.appendChild(
        answerRow(
          "decline",
          t("quoteDecline"),
          "quote-decision",
          function () {
            return { decision: "DECLINED", name: trimmedName() };
          },
          t("waDecline"),
          true,
        ),
      );
    }
    if (delivered) {
      box.appendChild(
        answerRow(
          "deviceAck",
          t("deviceAck"),
          "receipt",
          function () {
            return { kind: "DEVICE_RECEIVED", name: trimmedName() };
          },
          t("waDeviceAck"),
          false,
        ),
      );
      box.appendChild(feedbackNode());
    }
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
    var answers = answersNode();
    if (answers) host.appendChild(answers);
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
    // A new link is a new job: an answer sent on the old one must not silence a button on this one.
    sent = {};
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
