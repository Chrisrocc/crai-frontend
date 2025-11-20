// src/components/utils/dateTime.jsx
// ----------------------------------------------------------
// TOTAL REWRITE — Fixes rolling “today/tomorrow” forever.
// After the first normalization, the date becomes LOCKED
// (e.g. “Thu 21/11”) and will NEVER roll forward again.
// ----------------------------------------------------------

const WEEKDAYS_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAYS_FULL  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const MONTHS_SHORT   = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

const pad2 = (n) => String(n).padStart(2, "0");

const normalizeSpaces = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

const normalizeText = (s) =>
  normalizeSpaces(
    s
      .replace(/[.,]+/g, " ")
      .replace(/\btodat\b/g, "today")
      .replace(/\btmrw\b|\btomoz\b|\btomo\b/g, "tomorrow")
      .replace(/\barvo\b/g, "afternoon")
  );

// ----------------------------------------------------------
// Vague input detector — these are NOT normalized
// ----------------------------------------------------------
const VAGUE_RE = new RegExp(
  [
    "\\b(next|this|last)\\s+(week|month|year)\\b",
    "\\b(in\\s+(a|one|couple|few)\\s+(days|weeks)|few\\s+days|couple\\s+of\\s+days)\\b",
    "\\bsoon\\b"
  ].join("|"),
  "i"
);

// ----------------------------------------------------------
// PARSE: locked normalized label like “Thu 21/11 14:30”
// ----------------------------------------------------------
function parseLockedLabel(text, yearHint) {
  const m = text
    .trim()
    .match(/^(sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/i);

  if (!m) return null;
  const dd = parseInt(m[2], 10);
  const mm = parseInt(m[3], 10) - 1;

  if (Number.isNaN(dd) || Number.isNaN(mm)) return null;

  const y = yearHint || new Date().getFullYear();
  const d = new Date(y, mm, dd);

  if (m[4] && m[5]) {
    const hh = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    if (!Number.isNaN(hh) && !Number.isNaN(min)) {
      d.setHours(hh, min, 0, 0);
    }
  }

  return d;
}

// ----------------------------------------------------------
// FORMAT: locked label generator → “Thu 21/11 13:00”
// ----------------------------------------------------------
function formatLocked(dateObj) {
  const dowIdx = dateObj.getDay();
  const EEE = WEEKDAYS_SHORT[dowIdx][0].toUpperCase() + WEEKDAYS_SHORT[dowIdx].slice(1);

  const base = `${EEE} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

  const hh = dateObj.getHours();
  const mm = dateObj.getMinutes();

  // Midnight → no time shown
  if (hh === 0 && mm === 0) return base;

  return `${base} ${pad2(hh)}:${pad2(mm)}`;
}

// ----------------------------------------------------------
// Parse explicit dates
// ----------------------------------------------------------
function parseExplicitDate(text, refYear) {
  // dd/mm(/yy/yyy)
  let m = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m) {
    let dd = parseInt(m[1], 10);
    let mm = parseInt(m[2], 10) - 1;
    let yyyy = m[3] ? parseInt(m[3], 10) : refYear;
    if (String(yyyy).length === 2) yyyy = 2000 + yyyy;
    return new Date(yyyy, mm, dd);
  }

  // yyyy-mm-dd
  m = text.match(/\b(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  // 27 sep
  m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = MONTHS_SHORT.indexOf(m[2].slice(0, 3));
    if (mm >= 0) return new Date(refYear, mm, dd);
  }

  // sep 27
  m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/);
  if (m) {
    const mm = MONTHS_SHORT.indexOf(m[1].slice(0, 3));
    const dd = parseInt(m[2], 10);
    if (mm >= 0) return new Date(refYear, mm, dd);
  }

  return null;
}

// ----------------------------------------------------------
// Time extractor
// ----------------------------------------------------------
function extractTime(text) {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  let minute = m[2] ? parseInt(m[2], 10) : 0;

  if (m[3]) {
    const ampm = m[3].toLowerCase();
    if (ampm === "am" && hour === 12) hour = 0;
    if (ampm === "pm" && hour < 12) hour += 12;
  } else {
    if (/morning/.test(text)) hour = Math.max(hour, 8);
    if (/afternoon/.test(text)) hour = Math.max(hour, 13);
    if (/evening/.test(text)) hour = Math.max(hour, 17);
    if (/tonight/.test(text)) hour = Math.max(hour, 18);
  }

  return { hour, minute };
}

// ----------------------------------------------------------
// MAIN — normalize only ONCE, then lock it forever
// ----------------------------------------------------------
export function standardizeDayTime(rawText, nowOpt) {
  const now = nowOpt ? new Date(nowOpt) : new Date();

  const TRIM = rawText ? rawText.trim() : "";
  if (!TRIM) {
    return { label: null, isToday: false, isTomorrow: false, date: null, shouldReplaceRaw: false };
  }

  // Already normalized? → NEVER CHANGE IT.
  const locked = parseLockedLabel(TRIM, now.getFullYear());
  if (locked) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    return {
      label: formatLocked(locked),
      isToday: locked.toDateString() === today.toDateString(),
      isTomorrow: locked.toDateString() === tomorrow.toDateString(),
      date: locked,
      shouldReplaceRaw: false,     // don't overwrite an already-locked string
    };
  }

  const text = normalizeText(TRIM);

  // Vague? → Do not normalize.
  if (VAGUE_RE.test(text)) {
    return { label: null, isToday: false, isTomorrow: false, date: null, shouldReplaceRaw: false };
  }

  const year = now.getFullYear();
  const today = new Date(year, now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  let date = parseExplicitDate(text, year);

  if (!date) {
    if (/\btoday\b/.test(text)) date = new Date(today);
    else if (/\btomorrow\b/.test(text)) date = new Date(tomorrow);
  }

  // Weekday names (next occurrence, including today)
  if (!date) {
    for (let i = 0; i < 7; i++) {
      if (
        new RegExp(`\\b${WEEKDAYS_SHORT[i]}\\b`).test(text) ||
        new RegExp(`\\b${WEEKDAYS_FULL[i]}\\b`).test(text)
      ) {
        const d = new Date(today);
        const delta = (i - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + delta);
        date = d;
        break;
      }
    }
  }

  if (!date) {
    return { label: null, isToday: false, isTomorrow: false, date: null, shouldReplaceRaw: false };
  }

  // Time
  date.setHours(0, 0, 0, 0);
  const t = extractTime(text);
  if (t) date.setHours(t.hour, t.minute, 0, 0);

  const label = formatLocked(date);

  return {
    label,
    isToday: date.toDateString() === today.toDateString(),
    isTomorrow: date.toDateString() === tomorrow.toDateString(),
    date,
    shouldReplaceRaw: true,      // overwrite raw text to lock date permanently
  };
}

// ----------------------------------------------------------
// UI highlight
//-----------------------------------------------------------
export function dayTimeHighlightClass(rawText, nowOpt) {
  const { label, isToday, isTomorrow } = standardizeDayTime(rawText, nowOpt);
  if (!label) return "";
  return isToday ? "is-today" : isTomorrow ? "is-tomorrow" : "";
}
//test