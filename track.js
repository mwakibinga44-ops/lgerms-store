/*
 * LGERMS customer tracking page — one file per job, addressed by the token printed on the customer's slip.
 * There is no index to browse: holding one link shows one job. The shop words (name, WhatsApp, phone) come
 * from ./catalog.json. No build step, no framework.
 *
 * The page runs the loop in both directions. It reads ./track/<token>.json, the mirror the workshop pushes
 * every half hour; when catalog.json publishes a public https shop.api it reads that address instead and
 * re-reads it once a minute, so a step the counter took shows on the link within the same look. What the
 * workshop already holds as this customer's answer is shown back under "Yaliyofikia karakana", including the
 * answers that arrived by WhatsApp and were typed in at the counter. A customer's own answer goes to that api
 * when there is one and to WhatsApp when there is not. Nothing else is ever uploaded.
 */
(function () {
  "use strict";

  var LANG_KEY = "lgerms.storefront.lang.v1";
  var NAME_KEY = "lgerms.storefront.name.v1";
  var STALE_MS = 6 * 60 * 60 * 1000;
  /** How often the page re-reads the shop: a link that can reach the API watches the live record. */
  var POLL_API_MS = 60 * 1000;
  /** The pushed mirror is a file on a CDN, so a slower look is both enough and kinder to it. */
  var POLL_FILE_MS = 5 * 60 * 1000;
  var TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var NBSP_THIN = "\u202F";

  var MONTHS = {
    sw: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };

  var STR = {
    pageTitle: { sw: "Fuatilia ukarabati wako | LubhaTech", en: "Track your repair | LubhaTech" },
    pageTitleShort: { sw: "Fuatilia ukarabati wako", en: "Track your repair" },
    pageDesc: {
      sw: "Angalia hali ya ukarabati wa kifaa chako karakani kwa kutumia kiungo au nambari uliyopewa.",
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
    estimateTitle: { sw: "Kadirio la bei", en: "Quotation" },
    estimateTotal: { sw: "Jumla ya kadirio", en: "Quoted total" },
    estimateIssued: {
      sw: "Kadirio hili bado halijathibitishwa — gharama ya mwisho inaweza kubadilika.",
      en: "This quote is not yet approved — the final cost may change.",
    },
    estimateApproved: {
      sw: "Kadirio limethibitishwa. Gharama ya mwisho inathibitishwa kwenye kaunta.",
      en: "The quote is approved. The counter confirms the final cost.",
    },
    estimateValidUntil: { sw: "Halisi hadi", en: "Valid until" },
    noEstimate: {
      sw: "Hakuna kadirio la bei lililotolewa bado. Kaunta itakujulisha baada ya ukaguzi.",
      en: "No quote has been issued yet. The counter will tell you after the inspection.",
    },
    estimateClosed: {
      sw: "Umeshalijibu kadirio hili la bei, kwa hivyo bei yake haipo hapa tena. Uliza kaunta bei ya mwisho na jinsi ya kulipa.",
      en: "You have answered this quotation, so its price is no longer shown here. Ask the counter for the final cost and how to pay.",
    },
    askTitle: { sw: "Uliza kuhusu kazi hii", en: "Ask about this job" },
    askMsg: {
      sw: "Swali kuhusu kazi hii ya ukarabati",
      en: "A question about this repair job",
    },
    viaPhone: { sw: "Piga simu", en: "Call the shop" },
    counterNote: {
      sw: "Hakuna nambari ya WhatsApp au simu iliyowekwa — tafadhali ulize kwenye kaunta.",
      en: "No WhatsApp or phone number is set — please ask at the counter.",
    },
    pasteLabel: { sw: "Kiungo au nambari ya kufuatilia", en: "Tracking link or code" },
    pastePlaceholder: {
      sw: "mfano: https://…/track.html?t=… au a1b2c3d4-…",
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
    echoTitle: { sw: "Yaliyofikia karakana", en: "What reached the workshop" },
    echoIntro: {
      sw: "Haya ndiyo majibu yaliyorekodiwa kwa kazi hii — awe yalitumwa hapa kwenye kiungo au yaliandikwa na mtu wa kaunta.",
      en: "These are the answers recorded for this job — whether sent from this link or written down at the counter.",
    },
    echoAccept: { sw: "Ulikubali kadirio hili", en: "You accepted this quotation" },
    echoDecline: { sw: "Ulikataa kadirio hili", en: "You declined this quotation" },
    echoQuoteAck: { sw: "Umesema umepokea kadirio la bei", en: "You said you received the quotation" },
    echoDeviceAck: { sw: "Umesema ulichukua kifaa", en: "You said you collected the device" },
    echoFeedback: {
      sw: "Umetuma maoni mara {n}",
      en: "You have sent {n} opinion(s)",
    },
    echoWrittenByCounter: {
      sw: "limeandikwa na mtu wa kaunta",
      en: "written down at the counter",
    },
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
    quoteAck: { sw: "Nimepokea kadirio hili", en: "I have received this quotation" },
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
      sw: "Umetuma jibu hili tayari.",
      en: "You have already sent this answer.",
    },
    answerOffline: {
      sw: "Karakana bado haijapanga njia ya kujibu mtandaoni, kwa hivyo kitufe hiki kinafungua WhatsApp uandikie kaunta. Jibu lako hapo huandikwi kwenye mfumo hadi mtu wa kaunta aandike.",
      en: "This workshop has not set up an online answer path, so this button opens WhatsApp for you to write to the counter. Nothing is recorded until the counter types it in.",
    },
    sendFailed: {
      sw: "Jibu lako halijafikia karakana. Jaribu tena, au tumia WhatsApp / ulize kaunta.",
      en: "Your answer did not reach the workshop. Try again, or use WhatsApp / ask at the counter.",
    },
    busy: { sw: "Inatuma…", en: "Sending…" },
    errorByCode: {
      NO_OPEN_QUOTATION: {
        sw: "Hakuna kadirio la bei linalosubiri jibu lako kwa kazi hii.",
        en: "There is no quotation waiting for your answer on this job.",
      },
      QUOTE_ALREADY_DECIDED: {
        sw: "Kadirio hili tayari limepata jibu. Badilisha jibu kwa kuuliza kaunta.",
        en: "This quotation already has an answer. Ask the counter to change it.",
      },
      QUOTE_EXPIRED: {
        sw: "Kadirio hili limeisha muda wake. Kaunta itatoa jipya.",
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
        sw: "Hakuna kadirio la bei lililotolewa bado kwa kazi hii.",
        en: "No quotation has been issued for this job yet.",
      },
      DEVICE_NOT_HANDED_BACK: {
        sw: "Karakana bado haijarekodi kukikabidhi kifaa hiki.",
        en: "The workshop has not recorded handing this device back.",
      },
      TOO_MANY_REQUESTS: {
        sw: "Majaribio mengi kwa dakika moja. Subiri kidogo kisha ujaribu tena.",
        en: "Too many tries in one minute. Wait a moment and try again.",
      },
    },
    waAccept: { sw: "Nakubali", en: "I accept" },
    waDecline: { sw: "Nakataa", en: "I decline" },
    waQuoteAck: { sw: "Nimepokea kadirio", en: "I have received the quotation" },
    waDeviceAck: { sw: "Nimechukua kifaa changu", en: "I have collected my device" },
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
  /** Words typed into the opinion box, kept across a refresh so a poll never throws them away. */
  var draftWords = "";
  var pollTimer = null;

  function t(key) {
    var entry = STR[key];
    if (!entry) return key;
    return entry[lang] != null ? entry[lang] : entry.sw;
  }

  /** One number into a sentence, because the shop counts opinions but the page does not hold a plural table. */
  function fill(text, value) {
    return String(text).replace("{n}", String(value));
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
  /**
   * The address this page was opened with, token and all. When a message about a job has to leave the page it
   * carries this and nothing else: the job number runs in sequence, and a WhatsApp chat log is not the
   * workshop's to protect. The counter opens the link and reads the job off it, which is what the paper slip
   * does for them too.
   */
  function ownLink() {
    var base = String(window.location.href || "").split("#")[0].split("?")[0];
    return token ? base + "?t=" + encodeURIComponent(token) : base;
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
    var answered = job.answers && job.answers.decision;
    // The feed already withholds the price of a quotation the customer answered; this says the same thing to
    // a browser holding an older copy of that file, so the number cannot outlive the answer by one refresh.
    if (answered && job.answers.decidedOnCurrentQuote) {
      var closed = el("div", "estimate");
      closed.appendChild(el("p", "estimate-note", t("estimateClosed")));
      return closed;
    }
    var e = job.estimate;
    if (!e) {
      var none = el("div", "estimate");
      // Saying "nothing was quoted" over their own decision would deny them what they told the shop, so the
      // closed wording is used from the answer alone — the feed drops the price exactly when it is answered.
      none.appendChild(el("p", "estimate-note", t(answered ? "estimateClosed" : "noEstimate")));
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
    // Neither the job number nor the name the customer typed rides in the message. The link says which job
    // without telling anybody else that this person has work in this workshop, and the counter opening it
    // reads the reference off the same page the customer is looking at.
    return [shortLabel, ownLink()].join(" — ");
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

  /**
   * Whether a control has nothing left to ask. The page's own memory counts, but so does the workshop's
   * record: an answer that came by WhatsApp and was written in at the counter is already given, and the
   * customer must not be invited to say it a second time.
   */
  function answeredAlready(id) {
    if (sent[id]) return true;
    var a = job && job.answers;
    if (!a) return false;
    if (id === "quoteAck") return !!a.quoteAckAt;
    if (id === "deviceAck") return !!a.deviceAckAt;
    if (id === "accept") return a.decision === "APPROVED" && a.decidedOnCurrentQuote === true;
    if (id === "decline") return a.decision === "DECLINED" && a.decidedOnCurrentQuote === true;
    // An opinion is not a one-time answer: the shop expects more than one after the work is done.
    return false;
  }

  /** One answer, one row: a button into the shop's API, or a WhatsApp link when there is no API. */
  function answerRow(id, label, path, makeBody, waShort, soft) {
    var row = el("div", "answer-row");
    if (answeredAlready(id)) {
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

  /**
   * The opinion block. Only the online path can collect a rating and the words in a form worth reading by
   * the counter; on WhatsApp the customer writes them in the chat, so the row is one link that says what
   * the message is about.
   */
  function feedbackNode() {
    var block = el("div", "answer-block");
    block.appendChild(el("p", "estimate-label", t("feedbackTitle")));
    if (sent.feedback) {
      block.appendChild(el("p", "answer-ok", t("answerAlready")));
      return block;
    }
    var rating = null;
    var words = null;
    if (apiBase()) {
      rating = el("select");
      rating.id = "answerRating";
      var none = el("option", null, t("ratingNone"));
      none.value = "";
      rating.appendChild(none);
      [5, 4, 3, 2, 1].forEach(function (n) {
        var o = el("option", null, n + "/5");
        o.value = String(n);
        rating.appendChild(o);
      });
      words = el("textarea");
      words.id = "answerWords";
      words.rows = 3;
      words.maxLength = 1000;
      words.value = draftWords;
      words.addEventListener("input", function () {
        draftWords = words.value;
      });
      var rLabel = el("label", null, t("feedbackRating"));
      rLabel.setAttribute("for", "answerRating");
      var wLabel = el("label", null, t("feedbackMessage"));
      wLabel.setAttribute("for", "answerWords");
      block.appendChild(rLabel);
      block.appendChild(rating);
      block.appendChild(wLabel);
      block.appendChild(words);
    }
    block.appendChild(
      answerRow(
        "feedback",
        t("feedbackSend"),
        "feedback",
        function () {
          var message = String(words ? words.value : "").trim();
          if (message.length < 3) return t("feedbackShort");
          var body = { name: trimmedName(), message: message };
          var score = toNumber(rating ? rating.value : "");
          if (score !== null) body.rating = score;
          return body;
        },
        t("feedbackTitle"),
        false,
      ),
    );
    return block;
  }

  /**
   * The workshop's own record of this customer's answers, read back to them. It stays a set of facts — what
   * was answered, when, and whether a colleague typed it in — and never a copy of the words they used.
   */
  function echoNode() {
    var a = job.answers;
    if (!a) return null;
    var rows = [];
    if (a.decision && a.decidedOnCurrentQuote) {
      rows.push([a.decision === "APPROVED" ? t("echoAccept") : t("echoDecline"), a.decidedAt, !a.decidedOnline]);
    }
    if (a.quoteAckAt) rows.push([t("echoQuoteAck"), a.quoteAckAt, a.quoteAckByCounter]);
    if (a.deviceAckAt) rows.push([t("echoDeviceAck"), a.deviceAckAt, a.deviceAckByCounter]);
    if (a.opinions) rows.push([fill(t("echoFeedback"), a.opinions), a.feedbackAt, a.feedbackByCounter]);
    if (!rows.length) return null;

    var box = el("div", "card track-card echo-card");
    box.appendChild(el("h2", "section-title", t("echoTitle")));
    box.appendChild(el("p", "card-desc", t("echoIntro")));
    var list = el("ul", "echo-list");
    rows.forEach(function (row) {
      var li = el("li", "echo-item");
      li.appendChild(el("p", "echo-line", row[0] + (row[2] ? " — " + t("echoWrittenByCounter") : "")));
      var when = humanDateTime(row[1]);
      if (when) li.appendChild(el("p", "echo-when", when));
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
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
    if (apiBase()) {
      box.appendChild(nameField());
    } else {
      // Nothing typed here reaches the workshop by itself, so the name box is not offered: on this path the
      // shop hears the answer only when the counter writes it down.
      box.appendChild(el("p", "card-note", t("answerOffline")));
    }
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
    // The question carries the same token link the answer buttons do. The job number would say less, not more:
    // it runs in sequence, so a chat log holding it and a name would tell anybody reading it who has work
    // here, while the link points the counter at one job without naming the person standing at it.
    var msg = waAnswerText(t("askMsg"));
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
    var echo = echoNode();
    if (echo) host.appendChild(echo);
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

  /**
   * Where this job is read from. A workshop that published a public https address is asked directly, so an
   * answer lands on the link within a minute; one that has not gets the pushed mirror, which is the same
   * figures written by the same service and refreshed every half hour.
   */
  function jobUrl() {
    var api = apiBase();
    return api ? api + "/store/jobs/" + encodeURIComponent(token) : "./track/" + token + ".json";
  }

  /** The parts a refresh may legitimately change; nothing else is worth redrawing the page for. */
  function readSignature(data) {
    if (!data) return "";
    var a = data.answers || {};
    return [
      data.state,
      data.updatedAt,
      data.generatedAt,
      data.estimate ? data.estimate.status + "/" + data.estimate.total : "",
      a.decision,
      a.decidedAt,
      a.quoteAckAt,
      a.deviceAckAt,
      a.feedbackAt,
      a.opinions,
    ].join("|");
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * One timer for one link, at the pace that source can bear. A tab the customer left is not worth fetching
   * for: the timer keeps ticking, the work is skipped, and coming back to it reads the page straight away.
   */
  function startPolling() {
    stopPolling();
    if (!token) return;
    pollTimer = setInterval(function () {
      if (!document.hidden) readJob(false);
    }, apiBase() ? POLL_API_MS : POLL_FILE_MS);
  }

  function readJob(isFirst) {
    if (!token) return Promise.resolve();
    return getJson(jobUrl())
      .then(function (data) {
        if (!data || typeof data !== "object" || !data.code) {
          throw new Error("empty");
        }
        // The answer must be about the link that asked — never show one customer their neighbour's job.
        if (extractToken(data.code) !== token) throw new Error("mismatch");
        var next = readSignature(data);
        // A refresh that found nothing new leaves the page alone, including what the customer is typing.
        if (!isFirst && next === readSignature(job)) return;
        job = data;
        currency = data.currency || currency;
        renderChrome();
        renderJob();
      })
      .catch(function () {
        // Only a first read may claim the job does not exist; a later failure keeps the last good page up.
        if (isFirst) {
          job = null;
          showMessage("notFoundTitle", "notFoundBody");
          renderChrome();
        }
      });
  }

  function loadJob(next) {
    token = next;
    job = null;
    badCode = false;
    // A new link is a new job: an answer sent on the old one must not silence a button on this one.
    sent = {};
    draftWords = "";
    stopPolling();
    var err = document.getElementById("codeError");
    err.hidden = true;
    err.textContent = "";
    renderChrome();

    if (!token) {
      renderAll();
      return;
    }
    readJob(true).then(startPolling);
  }

  // ---------- events ----------
  function wireEvents() {
    // A tab the customer left stops being fetched for, and coming back to it is the moment they want the
    // workshop's latest word — so the first thing a visible page does is read again.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && token) readJob(false);
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
