// src/components/utils/dateTime.jsx
// Free-text day/time normalizer -> { label, isToday, isTomorrow, date }
//
// Behavior summary:
// - If the text is already in our normalized label format ("Mon 27/9" or "Mon 27/9 14:00"),
//   we return that label verbatim (LOCKED; never rolls).
// - If the text is a *vague* phrase (e.g., "next week", "this week", "few days", "soon"),
//   we DO NOT normalize: label=null, so UI shows the raw text and no highlight.
// - Otherwise we normalize concrete inputs (today/tomorrow/weekday/explicit date [+ optional time]).
// - AM/PM is optional; words like morning/afternoon/evening nudge hours sensibly.
// - Blank/NA-like input returns label=null (no highlight, UI can show raw/—).

// ---------- helpers ----------
const clampInt = (s, min, max) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : NaN;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_FULL = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

const nowLocal = () => new Date();

const normalizeSpaces = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

const normalizeText = (s) => {
  if (!s) return "";
  return normalizeSpaces(
    s
      .toLowerCase()
      .replace(/[.,]+/g, " ")
      .replace(/\btodat\b/g, "today")
      .replace(/\btmrw\b|\btomoz\b|\btomo\b/g, "tomorrow")
      .replace(/\barvo\b/g, "afternoon")
  );
};

const pad2 = (n) => String(n).padStart(2, "0");

const formatEEE_dM = (d) => {
  const dow = WEEKDAYS[d.getDay()];
  const EEE = dow[0].toUpperCase() + dow.slice(1);
  return `${EEE} ${d.getDate()}/${d.getMonth() + 1}`;
};

const nextWeekday = (from, targetDow, mode = "gte") => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const cur = d.getDay();
  let delta = (targetDow - cur + 7) % 7;
  if (mode === "gt" && delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
};

// ---------- vague detector ----------
// If it matches, we *do not* normalize (leave label=null so raw text shows, no highlight).
const VAGUE_RE = new RegExp(
  [
    // weeks / months / years
    "\\b(next|this|last)\\s+(week|month|year)\\b",
    // relative but not specific
    "\\b(in\\s+(a|one|couple|few)\\s+(days|weeks)|few\\s+days|couple\\s+of\\s+days)\\b",
    // generic vague
    "\\bsoon\\b",
  ].join("|"),
  "i"
);

// ---------- spelled-time & numeric-time ----------
const NUMWORDS = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17,
  eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50,
};

function parseSpelledTime(text, now) {
  // "in one hour", "in 2 hours"
  const inMatch = text.match(/\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hour/);
  if (inMatch) {
    const n = NUMWORDS[inMatch[1]] ?? parseInt(inMatch[1], 10) ?? 1;
    const d = new Date(now);
    d.setHours(d.getHours() + n);
    return { h: d.getHours(), m: d.getMinutes(), baseDate: d };
  }

  const words = Object.keys(NUMWORDS).join("|");

  // "two thirty"
  const twoPart = text.match(new RegExp(`\\b(${words})\\s+(${words})\\b`));
  if (twoPart) {
    const h = NUMWORDS[twoPart[1]];
    const mWord = NUMWORDS[twoPart[2]];
    if (!Number.isNaN(h) && !Number.isNaN(mWord)) {
      return { h, m: mWord, baseDate: new Date(now) };
    }
  }

  // "three"
  const single = text.match(new RegExp(`\\b(${words})\\b`));
  if (single) {
    const h = NUMWORDS[single[1]];
    if (!Number.isNaN(h)) {
      return { h, m: 0, baseDate: new Date(now) };
    }
  }

  return null;
}

function extractTime(t) {
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  const h = clampInt(m[1], 0, 23);
  const mm = m[2] != null ? clampInt(m[2], 0, 59) : 0;
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return { h, m: mm, ampm };
}

function resolveHourMin(baseHour, baseMin, ampm, text) {
  let h = baseHour;
  let m = baseMin;

  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "am" && h === 12) h = 0;
    if (lower === "pm" && h < 12) h += 12;
  } else {
    // Nudge when no AM/PM is given
    if (/\bmorning\b/.test(text)) h = Math.min(Math.max(h, 8), 11);
    else if (/\bafternoon\b|\barvo\b/.test(text)) h = Math.min(Math.max(h, 13), 16);
    else if (/\bevening\b/.test(text)) h = Math.min(Math.max(h, 17), 20);
    else if (/\btonight\b/.test(text)) h = Math.min(Math.max(h, 18), 22);
  }
  return { h, m };
}

// ---------- explicit date parsers ----------
function parseNormalizedLabel(raw, yearHint) {
  const m = raw.trim().match(/^(sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/i);
  if (!m) return null;

  const [, , dd, mm, hh, min] = m;
  const d = clampInt(dd, 1, 31);
  const mo = clampInt(mm, 1, 12) - 1;
  if (Number.isNaN(d) || Number.isNaN(mo)) return null;

  const y = yearHint || new Date().getFullYear();
  const date = new Date(y, mo, d);

  if (hh != null) {
    const H = clampInt(hh, 0, 23);
    const M = clampInt(min, 0, 59);
    if (!Number.isNaN(H) && !Number.isNaN(M)) date.setHours(H, M, 0, 0);
  }
  return date;
}

function parseExplicitDate(text, refYear) {
  // dd/mm(/yyyy)?
  let m = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m) {
    let d = clampInt(m[1], 1, 31);
    let mo = clampInt(m[2], 1, 12) - 1;
    let y = m[3] ? clampInt(m[3], 1970, 9999) : refYear;
    if (String(y).length === 2) y = 2000 + y;
    return new Date(y, mo, d);
  }

  // yyyy-mm-dd
  m = text.match(/\b(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const y = clampInt(m[1], 1970, 9999);
    const mo = clampInt(m[2], 1, 12) - 1;
    const d = clampInt(m[3], 1, 31);
    return new Date(y, mo, d);
  }

  // 27 sep / 27 september
  m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/);
  if (m) {
    const d = clampInt(m[1], 1, 31);
    const monTxt = m[2].slice(0, 3);
    const mo = MONTHS.indexOf(monTxt);
    if (mo >= 0) return new Date(refYear, mo, d);
  }

  // sep 27
  m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/);
  if (m) {
    const monTxt = m[1].slice(0, 3);
    const mo = MONTHS.indexOf(monTxt);
    const d = clampInt(m[2], 1, 31);
    if (mo >= 0) return new Date(refYear, mo, d);
  }

  return null;
}

// ---------- PUBLIC: normalize ----------
export function standardizeDayTime(rawText, nowOpt) {
  const now = nowOpt ? new Date(nowOpt) : nowLocal();

  // Blank / NA
  const rawTrim = (rawText ?? "").trim();
  if (!rawTrim || /\b(tbc|na|not sure)\b/i.test(rawTrim)) {
    return { label: null, isToday: false, isTomorrow: false, date: null };
  }

  // If already in our locked label format, preserve exactly
  const existing = parseNormalizedLabel(rawTrim, now.getFullYear());
  if (existing) {
    const base = existing;
    const labelBase = formatEEE_dM(base);
    const hasTime = base.getHours() !== 0 || base.getMinutes() !== 0;
    const label = hasTime ? `${labelBase} ${pad2(base.getHours())}:${pad2(base.getMinutes())}` : labelBase;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      label,
      isToday: base.toDateString() === today.toDateString(),
      isTomorrow: base.toDateString() === tomorrow.toDateString(),
      date: base,
    };
  }

  // If the text is vague (e.g., "next week"), DO NOT normalize
  const text = normalizeText(rawTrim);
  if (VAGUE_RE.test(text)) {
    return { label: null, isToday: false, isTomorrow: false, date: null };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // 1) explicit dates
  let baseDate = parseExplicitDate(text, now.getFullYear()) || null;

  // 2) relative: today/tomorrow
  if (!baseDate) {
    if (/\btoday\b/.test(text)) baseDate = new Date(today);
    else if (/\btomorrow\b/.test(text)) baseDate = new Date(tomorrow);
  }

  // 3) weekday phrases
  if (!baseDate) {
    const nextMatch = text.match(/\bnext\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (nextMatch) {
      const wd = nextMatch[1];
      const idx = WEEKDAYS.indexOf(wd.slice(0, 3));
      if (idx >= 0) baseDate = nextWeekday(today, idx, "gt");
    }
  }
  if (!baseDate) {
    for (let i = 0; i < 7; i++) {
      const short = WEEKDAYS[i], full = WEEKDAY_FULL[i];
      if (new RegExp(`\\b${short}\\b`).test(text) || new RegExp(`\\b${full}\\b`).test(text)) {
        baseDate = nextWeekday(today, i, "gte");
        break;
      }
    }
  }

  // If still nothing concrete, don't normalize
  if (!baseDate) {
    return { label: null, isToday: false, isTomorrow: false, date: null };
  }

  // 4) time (optional)
  let showTime = false, finalH = 0, finalM = 0;
  let time = extractTime(text) || parseSpelledTime(text, now);
  if (time) {
    const { h, m } = resolveHourMin(time.h, time.m, time.ampm, text);
    baseDate.setHours(h, m, 0, 0);
    showTime = true; finalH = h; finalM = m;
  } else {
    baseDate.setHours(0, 0, 0, 0);
  }

  // Build locked label
  const labelBase = formatEEE_dM(baseDate);
  const label = showTime ? `${labelBase} ${pad2(finalH)}:${pad2(finalM)}` : labelBase;

  return {
    label,
    isToday: baseDate.toDateString() === today.toDateString(),
    isTomorrow: baseDate.toDateString() === tomorrow.toDateString(),
    date: baseDate,
  };
}

// ---------- highlight helper ----------
export function dayTimeHighlightClass(rawText, nowOpt) {
  const { label, isToday, isTomorrow } = standardizeDayTime(rawText, nowOpt);
  // Only highlight when we produced a concrete label (i.e., not vague)
  if (!label) return "";
  return isToday ? "is-today" : isTomorrow ? "is-tomorrow" : "";
}
