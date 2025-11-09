// src/utils/dateTime.js
// Robust free-text day/time normalizer -> { label: "Sat 27/9 12:00", isToday, isTomorrow, date }

// ---- Helpers ----
const clampInt = (s, min, max) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : NaN;
};

const WEEKDAYS = ["sun","mon","tue","wed","thu","fri","sat"];
const WEEKDAY_FULL = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const nowLocal = () => new Date();

const normalizeText = (s) => {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+/g, " ")
    .replace(/\btodat\b/g, "today")
    .replace(/\btmrw\b|\btomoz\b|\btomo\b/g, "tomorrow")
    .replace(/\barvo\b/g, "afternoon")
    .trim();
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

const has = (t, word) => t.split(" ").includes(word);

// -------- Spelled time parser --------
// "two thirty", "three fifteen", "in one hour", "in 2 hours"
const NUMWORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

function parseSpelledTime(text, now) {
  // "in one hour", "in 2 hours"
  const inMatch = text.match(
    /\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hour/
  );
  if (inMatch) {
    const n = NUMWORDS[inMatch[1]] ?? parseInt(inMatch[1], 10) ?? 1;
    const d = new Date(now);
    d.setHours(d.getHours() + n);
    return { h: d.getHours(), m: d.getMinutes(), baseDate: d };
  }

  // "two thirty"
  const words = Object.keys(NUMWORDS).join("|");
  const twoPart = text.match(new RegExp(`\\b(${words})\\s+(${words})\\b`));
  if (twoPart) {
    const h = NUMWORDS[twoPart[1]];
    const mWord = NUMWORDS[twoPart[2]];
    if (!Number.isNaN(h) && !Number.isNaN(mWord))
      return { h, m: mWord, baseDate: new Date(now) };
  }

  // "three", "four"
  const single = text.match(new RegExp(`\\b(${words})\\b`));
  if (single) {
    const h = NUMWORDS[single[1]];
    if (!Number.isNaN(h)) return { h, m: 0, baseDate: new Date(now) };
  }

  return null;
}

// -------- Numeric time parser --------
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
    if (/\bmorning\b/.test(text)) h = Math.min(Math.max(h, 8), 11);
    else if (/\bafternoon|arvo\b/.test(text)) h = Math.min(Math.max(h, 13), 16);
    else if (/\bevening\b/.test(text)) h = Math.min(Math.max(h, 17), 20);
    else if (/\btonight\b/.test(text)) h = Math.min(Math.max(h, 18), 22);
  }
  return { h, m };
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

// -------- MAIN --------
export function standardizeDayTime(rawText, nowOpt, lockMode = true) {
  const now = nowOpt ? new Date(nowOpt) : nowLocal();
  const text = normalizeText(rawText);

  if (!text || /\btbc\b|\bna\b|\bnot sure\b/.test(text))
    return { label: null, isToday: false, isTomorrow: false, date: null };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. explicit numeric date — stays fixed forever
  let baseDate = parseExplicitDate(text, today.getFullYear());
  if (!baseDate && (has(text, "today") || /\btoday\b/.test(text))) baseDate = today;
  if (!baseDate && (has(text, "tomorrow") || /\btomorrow\b/.test(text))) baseDate = tomorrow;

  // 2. spelled or numeric time
  let time = extractTime(text);
  if (!time) time = parseSpelledTime(text, now);

  // 3. weekday only — lockMode means don’t roll
  if (!baseDate) {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text) || new RegExp(`\\b${WEEKDAY_FULL[i]}\\b`).test(text)) {
        baseDate = lockMode ? new Date(today) : nextWeekday(today, i, "gte");
        break;
      }
    }
  }

  // default to today
  if (!baseDate) baseDate = today;

  // 4. attach time
  let showTime = false;
  let finalH = 0, finalM = 0;
  if (time) {
    const { h, m } = resolveHourMin(time.h, time.m, time.ampm, text);
    baseDate.setHours(h, m, 0, 0);
    showTime = true;
    finalH = h;
    finalM = m;
  }

  // 5. build label
  const labelBase = formatEEE_dM(baseDate);
  const label = showTime ? `${labelBase} ${pad2(finalH)}:${pad2(finalM)}` : labelBase;
  const isToday = baseDate.toDateString() === today.toDateString();
  const isTomorrow = baseDate.toDateString() === tomorrow.toDateString();

  return { label, isToday, isTomorrow, date: baseDate };
}

// highlight helper
export function dayTimeHighlightClass(rawText, nowOpt) {
  const { isToday, isTomorrow } = standardizeDayTime(rawText, nowOpt);
  return isToday ? "is-today" : isTomorrow ? "is-tomorrow" : "";
}
