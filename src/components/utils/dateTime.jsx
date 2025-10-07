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
  let t = s.toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+/g, " ")
    .trim();

  // Common typos/aliases
  t = t
    .replace(/\btodat\b/g, "today")
    .replace(/\btmrw\b|\btomoz\b|\btomo\b/g, "tomorrow")
    .replace(/\barvo\b/g, "afternoon");

  return t;
};

const pad2 = (n) => String(n).padStart(2, "0");

const formatEEE_dM = (d) => {
  const dow = WEEKDAYS[d.getDay()];
  const EEE = dow[0].toUpperCase() + dow.slice(1); // "Sat"
  const day = d.getDate();            // no leading zero
  const month = d.getMonth() + 1;     // no leading zero
  return `${EEE} ${day}/${month}`;
};

// Get the next occurrence of weekday index (0=Sun..6=Sat)
// mode: "gte" (>= today) or "gt" (> today)
const nextWeekday = (from, targetDow, mode = "gte") => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const cur = d.getDay();
  let delta = (targetDow - cur + 7) % 7;
  if (mode === "gt" && delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
};

const has = (t, word) => t.split(" ").includes(word);

// Extract first time found: returns { h, m, ampm, raw } or null
function extractTime(t) {
  // matches: 12, 12:00, 7pm, 07:30PM, 19:05
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  const h = clampInt(m[1], 0, 23);
  const mm = m[2] != null ? clampInt(m[2], 0, 59) : 0;
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return { h, m: mm, ampm, raw: m[0] };
}

// Convert 12h to 24h if needed, apply part-of-day hints
function resolveHourMin(baseHour, baseMin, ampm, text) {
  let h = baseHour;
  let m = baseMin;

  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "am") {
      if (h === 12) h = 0;
    } else if (lower === "pm") {
      if (h < 12) h += 12;
    }
  } else {
    if (/\bmorning\b/.test(text)) {
      if (h < 6 || h > 11) h = (h % 12) || 9;
    } else if (/\bafternoon|arvo\b/.test(text)) {
      if (h < 12 || h > 17) h = 14;
    } else if (/\bevening\b/.test(text)) {
      if (h < 17 || h > 21) h = 18;
    } else if (/\btonight\b/.test(text)) {
      if (h < 17 || h > 23) h = 19;
    }
    // else leave as-is
  }
  return { h, m };
}

// Parse explicit date like 27/9(/2025), 2025-09-27, 27 sep, sep 27
function parseExplicitDate(text, refYear) {
  // dd/mm(/yyyy)?
  let m = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m) {
    let d = clampInt(m[1], 1, 31);
    let mo = clampInt(m[2], 1, 12) - 1;
    let y = m[3] ? clampInt(m[3], 1970, 9999) : refYear;
    if (String(y).length === 2) y = 2000 + y;
    if (!Number.isNaN(d) && !Number.isNaN(mo) && !Number.isNaN(y)) {
      return new Date(y, mo, d);
    }
  }

  // yyyy-mm-dd
  m = text.match(/\b(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const y = clampInt(m[1], 1970, 9999);
    const mo = clampInt(m[2], 1, 12) - 1;
    const d = clampInt(m[3], 1, 31);
    if (!Number.isNaN(d) && !Number.isNaN(mo) && !Number.isNaN(y)) {
      return new Date(y, mo, d);
    }
  }

  // 27 sep / 27 september
  m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\b/);
  if (m) {
    const d = clampInt(m[1], 1, 31);
    const monTxt = m[2].slice(0,3);
    const mo = MONTHS.indexOf(monTxt);
    if (!Number.isNaN(d) && mo >= 0) {
      return new Date(refYear, mo, d);
    }
  }

  // sep 27
  m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/);
  if (m) {
    const monTxt = m[1].slice(0,3);
    const mo = MONTHS.indexOf(monTxt);
    const d = clampInt(m[2], 1, 31);
    if (!Number.isNaN(d) && mo >= 0) {
      return new Date(refYear, mo, d);
    }
  }

  return null;
}

// Core resolver
export function standardizeDayTime(rawText, nowOpt) {
  const now = nowOpt ? new Date(nowOpt) : nowLocal();
  const text = normalizeText(rawText);

  if (!text || /\btbc\b|\bna\b|\bnot sure\b/.test(text)) {
    return { label: null, isToday: false, isTomorrow: false, date: null };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // 1) Try explicit date first
  let baseDate = parseExplicitDate(text, today.getFullYear());

  // 2) Keywords
  if (!baseDate) {
    if (has(text,"today")) baseDate = today;
    else if (has(text,"tomorrow")) baseDate = tomorrow;
  }

  // 3) Weekend
  if (!baseDate && /\bweekend\b/.test(text)) {
    const dow = today.getDay();
    const sat = nextWeekday(today, 6, "gte");
    baseDate = (dow <= 5) ? sat : nextWeekday(today, 6, "gt");
  }

  // 4) Weekday phrases: [this|next]? <weekday>
  if (!baseDate) {
    let wdIndex = -1;
    for (let i = 0; i < WEEKDAYS.length; i++) {
      if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text) || new RegExp(`\\b${WEEKDAY_FULL[i]}\\b`).test(text)) {
        wdIndex = i; break;
      }
    }
    if (wdIndex >= 0) {
      const isNext = /\bnext\b/.test(text);
      const isThis = /\bthis\b/.test(text);
      if (isNext) {
        const upcoming = nextWeekday(today, wdIndex, "gt");
        baseDate = new Date(upcoming); baseDate.setDate(baseDate.getDate() + 7);
      } else {
        baseDate = nextWeekday(today, wdIndex, "gte");
        if (isThis && baseDate.getTime() < today.getTime()) {
          baseDate.setDate(baseDate.getDate() + 7);
        }
      }
    }
  }

  // 5) Part of day only → today
  if (!baseDate && /\btonight|morning|afternoon|arvo|evening\b/.test(text)) {
    baseDate = today;
  }

  // 6) Time-only strings (e.g., "12", "12:00", "12pm")
  const time = extractTime(text);
  if (!baseDate && time) {
    let { h, m } = resolveHourMin(time.h, time.m, time.ampm, text);
    const cmpNow = now.getHours()*60 + now.getMinutes();
    const cmpTime = h*60 + m;
    baseDate = (cmpTime >= cmpNow) ? today : tomorrow;
  }

  if (!baseDate) {
    return { label: null, isToday: false, isTomorrow: false, date: null };
  }

  // 7) Attach time & roll if necessary
  let showTime = false;
  let finalH = 0;
  let finalM = 0;
  if (time) {
    let { h, m } = resolveHourMin(time.h, time.m, time.ampm, text);
    const saidToday = /\btoday\b/.test(text);
    const tentative = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m, 0, 0);

    // If user didn't explicitly say "today" and the computed time is in the past for today,
    // roll to tomorrow to represent the *next* occurrence of that time.
    if (!saidToday && tentative.toDateString() === today.toDateString()) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const tMin = h * 60 + m;
      if (tMin < nowMin) {
        tentative.setDate(tentative.getDate() + 1);
      }
    }
    baseDate = tentative;
    finalH = baseDate.getHours();
    finalM = baseDate.getMinutes();
    showTime = true;
  }

  const labelBase = formatEEE_dM(baseDate);
  const label = showTime ? `${labelBase} ${pad2(finalH)}:${pad2(finalM)}` : labelBase;

  const isToday = baseDate.toDateString() === today.toDateString();
  const isTomorrow = baseDate.toDateString() === tomorrow.toDateString();

  return { label, isToday, isTomorrow, date: baseDate };
}

// Convenience: highlight class
export function dayTimeHighlightClass(rawText, nowOpt) {
  const { isToday, isTomorrow } = standardizeDayTime(rawText, nowOpt);
  return isToday ? "is-today" : isTomorrow ? "is-tomorrow" : "";
}
