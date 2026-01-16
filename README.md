# The Choice Study — Bicultural Frame Switching (jsPsych)

A short, anonymous decision-making study built with **jsPsych** to test whether **cultural-frame activation** (Host vs Heritage) shifts **self–other weighting** in social decisions. Data are saved to **Google Sheets** via a **Google Apps Script** web app.

**Live study link:** https://neurochoice.github.io/identity-card-game/

---

## Study summary

- **Design:** within-subject; two conditions (Host vs Heritage) with counterbalanced order.
- **Language:** two short sections, one in English and one in Korean.
- **Per section:** brief prime (images/words), manipulation checks (salience + state self-construal + attention check), a short interactive decision task (trust/reciprocity battery), and a short exploratory choice task.
- **Target duration:** 10–15 minutes.
- **Eligibility:** intended for Korean–American bicultural bilingual adults. If ineligible, the study ends after screening.

---

## Measures (high level)

**Primary behavioural outcome**
- Trust/reciprocity decisions grounded in the investment/trust-game framework.

**Manipulation checks**
- Identity salience ratings (Host vs Heritage)
- State self-construal items (independent/interdependent)
- Attention check

**Individual-difference / controls**
- Bicultural Identity Integration (BII; short)
- Risk preference (brief)

**Exploratory secondary outcome**
- Short choice task (legacy “card” component), analysed as exploratory.

---

## Project files

Typical structure:

```
identity-card-game/
├─ index.html
├─ main.js
├─ style.css
└─ libs/ (jsPsych and plugins)
```

Notes:
- GitHub Pages is case-sensitive. Filenames and paths must match exactly.
- If you embed the study elsewhere, ensure the embed points to the same GitHub Pages URL.

---

## Data collection (Google Sheets)

1. Deploy a Google Apps Script Web App (HTTPS endpoint).
2. Set the endpoint URL in `main.js` (example key name may differ in your code):

```js
const UPLOAD_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

The upload payload includes screening/comprehension/attention flags so exclusions can be applied during analysis.

---

## Deploying updates

- Update `main.js` in the GitHub repo.
- Commit changes.
- Hard refresh the study page (Ctrl+F5) or test in a private window to avoid cached scripts.

---

## Contact

For questions about this study: psyneurograd@gmail.com
