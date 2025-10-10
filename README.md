# The Choice Study — Identity × Card Game (jsPsych)

A short, anonymous decision-making study built with **jsPsych**, designed to test how brief image/word exposure relates to fast choices in a simple card game. Data are stored as CSV in **Google Sheets** via an **Apps Script** endpoint.

> Participant-facing site: **[LIVE LINK HERE](https://YOUR-USERNAME.github.io/identity-card-game/)**  
> Contact: psyneurograd@gmail.com

---

## What this is

- Two counterbalanced parts (order randomised).  
- Part A (English / “Host”) and Part B (Korean / “Heritage”).  
- Short image slideshow + two quick prompts + a simple **card game** with another participant.  
- Optional **Korean comfort skip** (participants can proceed without the Korean block).  
- Built for pilots (5–7 minutes), robust enough for larger samples.

---

## File structure

```
identity-card-game/
├─ index.html                 # loads jsPsych + plugins + your main.js
├─ main.js                    # experiment logic
├─ style.css                  # site-level styles
├─ libs/
│  └─ jspsych/
│     ├─ jspsych.css
│     ├─ jspsych.js
│     ├─ plugin-html-button-response.js
│     ├─ plugin-html-keyboard-response.js
│     ├─ plugin-instructions.js
│     ├─ plugin-survey-text.js
│     └─ plugin-survey-likert.js
└─ stimuli/
   ├─ host1.jpg ...           # US/host images
   └─ heritage1.jpg ...       # KR/heritage images
```

**Note:** GitHub Pages is case-sensitive. Filenames and paths must match exactly.

---

## Running locally

Open `index.html` in a browser. If you make changes to `main.js`, hard-reload or add a cache-buster like:

```html
<script src="main.js?v=2"></script>
```

Increment `v=` when you deploy updates (1 → 2 → 3…).

---

## Data collection

- Results are saved as **full CSV** plus per-trial JSON to a Google Sheet.  
- Configure the Apps Script Web App and paste your `/exec` URL in `main.js`:

```js
const UPLOAD_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

- The script is tolerant: it posts raw JSON first; if blocked, retries as `payload=` form data.

---

## Prolific / panels (optional)

`main.js` captures Prolific query parameters if present:

```
?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...
```

Set the completion URL:

```js
const PROLIFIC_COMPLETION_URL =
  "https://app.prolific.com/submissions/complete?cc=YOURCODE";
```

At finish, a **Return to Prolific** button appears (or you can auto-redirect).

---

## Design notes

- **Counterbalance:** 50/50 starting block (Host ↔ Heritage).  
- **Trials:** Balanced 16-card set (AI × RI grid with one central extra), randomised order.  
- **Attention checks:** 1 per block (Likert, select “4”).  
- **Korean skip:** Bilingual handoff screen lets participants skip KR if uncomfortable.  
- **Viewport gate:** Blocks screens narrower than 320 px.

---

## Privacy & consent

- No personal identifiers are collected.  
- Participants can stop at any time.  
- Demographics are minimal (gender, age, residence; optional years in US/KR).  
- CSV is stored in a private Google Sheet under your control.

---

## Deploying on GitHub Pages

1. Go to **Settings → Pages**.  
2. **Source:** Deploy from a branch → `main` / `/root`.  
3. Wait 1–2 minutes for build → copy the live URL.  
4. Add that link to your Google Site “Start Study” button.

---

## Troubleshooting

- **Blank page / `initJsPsych is not defined`** → a jsPsych file failed to load.  
- **Images missing** → check case (`Heritage1.jpg` ≠ `heritage1.jpg`).  
- **No uploads** → verify `UPLOAD_URL` and Apps Script is set to **Anyone with the link**.

---

## License

MIT (feel free to reuse the scaffold; please cite if helpful).
