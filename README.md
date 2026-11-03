# LubhaTech shop window

A plain public page — `index.html`, `styles.css`, `app.js` — that shows the
workshop's own inventory list: spare parts and printed course handouts. There is
no second list to keep in step and nothing to tick on: a part the counter added is
on this page, a part they archived has left it. The price a customer reads is the
price the workshop last charged on a bill; when a discount was cut on that line the
written price is shown struck through beside it, and the date the price comes from
is printed under it. A part nobody has billed yet still appears, with "ask at the
counter" instead of a figure.

A customer ticks what they want and taps **Omba / Request**, which opens WhatsApp
with the list already written out. If no WhatsApp number is published the button
becomes a phone call, and if neither is published the page says to ask at the
counter. The same window lists the **kozi** the workshop is running — the course
fee, when it starts, where, how long and how many seats are left — and a card ends
in *Omba kujisajili*, which writes the session code into the message for you.
Registering a trainee is still done by staff at the counter.

There is **no** server, no cart, no online payment and no order form here. Nothing
is uploaded from this page: it only reads `catalog.json` sitting next to it.
Payment details, when the workshop publishes them, are printed as instructions
only — the order and the money are confirmed at the counter, the way they always
have.

## Fuatilia kazi yako — `track.html`

When a device is taken in, the slip now carries a second link:
`track.html?t=<code>`, where `<code>` is a random code written on that one job and
nowhere else. Opening it shows what the workshop is willing to tell a customer —
the state of the job and its Swahili/English names, the date it was received, the
steps recorded since, the device by model rather than by owner, and the estimate
the workshop issued (with a plain sentence saying an unapproved estimate can still
move). It does **not** show the customer's name or phone number, the serial or
IMEI, the fault as it was dictated, staff notes, or any bill balance.

Each job is published as its own file, `track/<code>.json`. There is no list of
them and nothing to browse: the code in your link opens your job and no other, and
the page refuses to display a file whose code is not the one its address asked for.
A job leaves the window when it is cancelled, judged unrepairable, or delivered
more than two weeks ago — and its file is removed on the next push.

If you were given the code on paper rather than a link, open `track.html` and paste
the code in.

### Majibu ya mteja — answering from the page

Below the steps, the page lets the customer answer three things, and nothing else:
**Nimepokea kadirio hili** (the quotation reached me), **Nakubali / Nakataa** (accept or
decline the price shown) while the job is still waiting on that answer, and once the
device has been handed back **Nimechukua kifaa changu** plus **Maoni yako** with a
rating out of five. The buttons carry only the customer's name and their choice — no
job id, no amount, no state — and every rule the counter follows is checked again on
the server, so a tap cannot move a price or a step by itself.

Where the answer goes depends on one published value, `shop.api` in `catalog.json`,
which is the workshop's `STORE_API_URL`:

- **Set** (must start with `https://`): the page posts to
  `<shop.api>/store/jobs/<code>/quote-decision`, `/receipt` or `/feedback`, and the
  server's own refusal is what the customer reads back — an expired quotation, one
  already answered, a job closed to answers, or too many taps in a minute.
- **Blank, or not `https://`**: the same buttons become WhatsApp links to the shop's
  number, with the job reference and the customer's name already written out, and the
  page says plainly that nothing is recorded until the counter types it in.

That second branch is what a workshop running only on its own network gets, and it is
the branch this build was tested on. Turning on the online path needs a public https
address for the API and that page's own address listed in `CORS_ORIGINS`; see
`docs/DEPLOYMENT_RUNBOOK.md`.

Either way, the page then reads the shop's book back to the customer. The **Yaliyofikia
karakana** block lists what was actually recorded — including an answer a colleague typed
in from a WhatsApp reply, which the page marks as written at the counter because that is
the half the customer cannot see. A quotation that has closed (declined, or replaced by a
new version) leaves the price block; the page then says **Kadirio hili la bei limekwisha**
rather than claiming nothing was ever quoted, and the customer's own answers stay listed.
Both directions of that exchange were walked against the running workshop API on 2026-11-04
(`docs/ONPREM_INSTALL.md` §5.6).

## catalog.json is written by the workshop

`catalog.json` is refreshed from inside the workshop and pushed to this repository
by the shopkeeper's own machine. Prices and stock counts are therefore as current
as the last push — the page says when they were taken, and asks you to confirm a
price if that snapshot looks old. Please do not edit this file by hand; the next
push replaces it.

Handouts have no downloadable copy. A customer sees the title, the price and how
many printed copies are on the shelf; the paper itself is handed over in person.

## Preview it locally

The folder has to be served over HTTP — opening `index.html` with `file://` will
not load the JSON.

```
npx --yes serve -l 8123 .
# then open http://127.0.0.1:8123
```

## What lives here

- `index.html` — page shell; starts in Kiswahili.
- `styles.css` — mobile-first card grid, one → two → three columns.
- `app.js` — reads `./catalog.json`, renders parts, handouts and the courses that
  are still open for registration, handles search, filters, quantities, the
  Kiswahili/English switch and the "prices updated at" notice. Tick marks and the
  chosen language are remembered on your own device only; nothing is sent anywhere
  until you tap the button.
- `track.html`, `track.js` — the customer's own page, opened by the code on their
  slip. It reads one file, `track/<code>.json`, and asks for the code by hand if no
  link was given. Marked `noindex` and excluded in `robots.txt`.
- `assets/logo.png` — the shop mark, with a text fallback if it fails to load.
- `.nojekyll`, `robots.txt` — static-hosting files.

Both pages carry their own `STR` dictionary (`{ sw, en }` per key) and start in Kiswahili. `npm run i18n:check` in the
repository root reads these two dictionaries too: a key missing its Kiswahili or English value, an empty value, a
`t("…")` call or `data-i18n` attribute with no entry, or an `STR` that is not a readable literal fails the build. The
vocabulary is the shop's, not a second set of names — **kadirio la bei** for the quotation the customer answers,
**ukarabati** for the repair, **kaunta** and **karakana** as everywhere else — and it is recorded in
`docs/KISWAHILI_GLOSSARY.md` §7 and §9.6.
