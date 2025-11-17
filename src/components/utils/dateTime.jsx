// src/utils/dateTime.js
// Free-text day/time normalizer -> { label, isToday, isTomorrow, date }
//
// Behavior summary:
// - First time: parse free text like "today", "tomorrow 9", "next monday 2pm" → normalized label
//   e.g., "Mon 17/11 09:00". You SAVE this label to DB.
// - Next times: call with the saved label as storedLabel → it RETURNS THE SAME LABEL (locked).
//   It NEVER rolls forward on the next day unless user edits again.
// - Parser supports numeric or spelled times, with or without am/pm.
// - Weekday words: "monday" = the next occurrence today-or-after; "next monday" = strictly after this week’s.
// - Returns:
//     label: "EEE d/M" or "EEE d/M HH:MM"
//     isToday / isTomorrow are computed against current day
//     date: JS Date object (local time)

//
// ---------- Helpers ----------
//
const clampInt = (s, min, max) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : NaN;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_FULL = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const nowLocal = () => new Date();

const normalizeSpaces = (s) =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

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

//
// -------- Spelled time parser --------
// "two thirty", "three fifteen", "in one hour", "in 2 hours"
//
const NUMWORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

function parseSpelledTime(text, now) {
  // "in one hour", "in 2 hours"
  const inMatch = text.match(
    /\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hour/i
  );
  if (inMatch) {
    const n = NUMWORDS[inMatch[1]?.toLowerCase()] ?? parseInt(inMatch[1], 10) ?? 1;
    const d = new Date(now);
    d.setHours(d.getHours() + n);
    return { h: d.getHours(), m: d.getMinutes(), baseDate: d, hadAmPm: false };
  }

  const words = Object.keys(NUMWORDS).join("|");

  // "two thirty"
  const twoPart = text.match(new RegExp(`\\b(${words})\\s+(${words})\\b`, "i"));
  if (twoPart) {
    const h = NUMWORDS[twoPart[1].toLowerCase()];
    const mWord = NUMWORDS[twoPart[2].toLowerCase()];
    if (!Number.isNaN(h) && !Number.isNaN(mWord)) {
      return { h, m: mWord, baseDate: new Date(now), hadAmPm: false };
    }
  }

  // "three"
  const single = text.match(new RegExp(`\\b(${words})\\b`, "i"));
  if (single) {
    const h = NUMWORDS[single[1].toLowerCase()];
    if (!Number.isNaN(h)) {
      return { h, m: 0, baseDate: new Date(now), hadAmPm: false };
    }
  }

  return null;
}

//
// -------- Numeric time parser --------
// Supports "9", "9:30", "9am", "9:30pm"
//
function extractTime(t) {
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  const h = clampInt(m[1], 0, 23);
  const mm = m[2] != null ? clampInt(m[2], 0, 59) : 0;
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return { h, m: mm, ampm, hadAmPm: !!ampm };
}

function resolveHourMin(baseHour, baseMin, ampm, text) {
  let h = baseHour;
  let m = baseMin;

  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "am" && h === 12) h = 0;
    if (lower === "pm" && h < 12) h += 12;
  } else {
    // No AM/PM: nudge based on words (optional)
    if (/\bmorning\b/.test(text)) h = Math.min(Math.max(h, 8), 11);
    else if (/\bafternoon\b|\barvo\b/.test(text)) h = Math.min(Math.max(h, 13), 16);
    else if (/\bevening\b/.test(text)) h = Math.min(Math.max(h, 17), 20);
    else if (/\btonight\b/.test(text)) h = Math.min(Math.max(h, 18), 22);
  }

  return { h, m };
}

//
// -------- Normalized label parser --------
// Accepts "Mon 27/9" or "Mon 27/9 12:00"
//
function parseNormalizedLabel(raw, yearHint) {
  if (!raw || typeof raw !== "string") return null;
  const m = raw
    .trim()
    .match(/^(sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/i);
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
    if (!Number.isNaN(H) && !Number.isNaN(M)) {
      date.setHours(H, M, 0, 0);
    }
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

//
// -------- Explicit date parsers --------
// Supports dd/mm(/yyyy), yyyy-mm-dd, "27 sep", "sep 27"
//
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
  m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/i);
  if (m) {
    const d = clampInt(m[1], 1, 31);
    const monTxt = m[2].slice(0, 3).toLowerCase();
    const mo = MONTHS.indexOf(monTxt);
    if (mo >= 0) return new Date(refYear, mo, d);
  }

  // sep 27
  m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/i);
  if (m) {
    const monTxt = m[1].slice(0, 3).toLowerCase();
    const mo = MONTHS.indexOf(monTxt);
    const d = clampInt(m[2], 1, 31);
    if (mo >= 0) return new Date(refYear, mo, d);
  }

  return null;
}

//
// -------- Core: normalize free text once --------
//
function normalizeFromFreeText(rawText, now) {
  const text = normalizeText(rawText);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1) Explicit date (dd/mm, yyyy-mm-dd, "27 sep", etc)
  let baseDate = parseExplicitDate(text, now.getFullYear()) || null;

  // 2) Relative: today / tomorrow
  if (!baseDate) {
    if (/\btoday\b/i.test(text)) {
      baseDate = new Date(today);
    } else if (/\btomorrow\b/i.test(text)) {
      baseDate = new Date(tomorrow);
    }
  }

  // 3) Weekday phrases
  if (!baseDate) {
    // "next monday"
    const nextMatch = text.match(
      /\bnext\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
    );
    if (nextMatch) {
      const wd = nextMatch[1].slice(0, 3).toLowerCase();
      const idxShort = WEEKDAYS.indexOf(wd);
      if (idxShort >= 0) {
        baseDate = nextWeekday(today, idxShort, "gt"); // strictly after this upcoming one
      }
    }
  }

  if (!baseDate) {
    // plain weekday -> upcoming (>= today)
    for (let i = 0; i < 7; i++) {
      const short = WEEKDAYS[i];
      const full = WEEKDAY_FULL[i];
      if (new RegExp(`\\b${short}\\b`, "i").test(text) || new RegExp(`\\b${full}\\b`, "i").test(text)) {
        baseDate = nextWeekday(today, i, "gte");
        break;
      }
    }
  }

  // 4) Default: if still nothing, assume today
  if (!baseDate) {
    baseDate = new Date(today);
  }

  // 5) Time (numeric or spelled), AM/PM optional
  let showTime = false;
  let finalH = 0;
  let finalM = 0;

  let time = extractTime(text);
  if (!time) time = parseSpelledTime(text, now);

  if (time) {
    const { h, m } = resolveHourMin(time.h, time.m, time.ampm, text);
    baseDate.setHours(h, m, 0, 0);
    showTime = true;
    finalH = h;
    finalM = m;
  } else {
    baseDate.setHours(0, 0, 0, 0);
  }

  // 6) Build normalized label (LOCK FORMAT)
  const labelBase = formatEEE_dM(baseDate);
  const label = showTime ? `${labelBase} ${pad2(finalH)}:${pad2(finalM)}` : labelBase;

  const isToday = baseDate.toDateString() === today.toDateString();
  const isTomorrow = baseDate.toDateString() === tomorrow.toDateString();

  return { label, isToday, isTomorrow, date: baseDate };
}

//
// -------- Public API --------
//

// Normalize once; keep forever unless edited.
// - rawText: what user typed OR the current input value
// - nowOpt: optional Date (or ISO/epoch) for testability
// - storedLabel: pass your previously saved normalized label here to KEEP it unchanged
export function standardizeDayTime(rawText, nowOpt, storedLabel) {
  const now = nowOpt ? new Date(nowOpt) : nowLocal();

  // If we already have a locked label from DB, return it as-is (never roll).
  if (storedLabel) {
    const parsed = parseNormalizedLabel(storedLabel, now.getFullYear());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = !!parsed && parsed.toDateString() === today.toDateString();
    const isTomorrow = !!parsed && parsed.toDateString() === tomorrow.toDateString();

    return { label: storedLabel, isToday, isTomorrow, date: parsed || null };
    // NOTE: even if parsed is null (bad storedLabel), we keep returning the stored string
    // so the UI shows exactly what was saved. You can add validation upstream if desired.
  }

  // First time parsing → produce a normalized label to save
  return normalizeFromFreeText(rawText, now);
}

// Helper for UI highlight classes (accepts either a rawText or a storedLabel)
export function dayTimeHighlightClass(rawTextOrLabel, nowOpt, storedLabel) {
  const { isToday, isTomorrow } = standardizeDayTime(rawTextOrLabel, nowOpt, storedLabel);
  return isToday ? "is-today" : isTomorrow ? "is-tomorrow" : "";
}
