// This app operates out of Dubai (UAE). Any time a host/staff member types
// a "naive" local time (e.g. into a <input type="datetime-local">), that
// input is meant to represent Dubai wall-clock time — not the browser's
// timezone, and definitely not the server's (Vercel's functions run in
// UTC, which is what caused the original bug: a naive string like
// "2026-08-15T14:00" was being reinterpreted as 14:00 UTC on the server,
// silently shifting every time slot by 4 hours).
//
// Asia/Dubai never observes daylight saving time, so a fixed +4:00 offset
// is always correct — no timezone library needed. If this ever needs to
// support a DST-observing timezone, this fixed-offset approach would need
// to be replaced with a proper timezone library (e.g. date-fns-tz).
export const COMPANY_TIMEZONE = process.env.NEXT_PUBLIC_COMPANY_TIMEZONE || "Asia/Dubai";
export const COMPANY_TIMEZONE_LABEL = process.env.NEXT_PUBLIC_COMPANY_TIMEZONE_LABEL || "Dubai time";

const FIXED_OFFSET_HOURS = { "Asia/Dubai": 4 };

function fixedOffsetString() {
  const hours = FIXED_OFFSET_HOURS[COMPANY_TIMEZONE];
  if (hours === undefined) {
    throw new Error(
      `No fixed UTC offset configured for "${COMPANY_TIMEZONE}" in lib/timezone.js. ` +
        `Add it to FIXED_OFFSET_HOURS if it never observes daylight saving time; ` +
        `otherwise this simple approach isn't safe to use for it.`
    );
  }
  const sign = hours >= 0 ? "+" : "-";
  return `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

/**
 * Converts a naive "YYYY-MM-DDTHH:mm" value (as produced by a
 * datetime-local input, understood to represent Dubai wall-clock time)
 * into a correct UTC ISO string. This MUST run wherever the value is first
 * captured — i.e. client-side, before sending to any API route — so it's
 * anchored to Dubai regardless of the server's own timezone.
 */
export function companyLocalToUtcIso(naiveLocalDatetime) {
  if (!naiveLocalDatetime) return null;
  const withSeconds = naiveLocalDatetime.length === 16 ? `${naiveLocalDatetime}:00` : naiveLocalDatetime;
  const d = new Date(`${withSeconds}${fixedOffsetString()}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Same idea, but for a plain "YYYY-MM-DD" date (start of day, Dubai time). */
export function companyLocalDateToUtcIso(naiveLocalDate) {
  if (!naiveLocalDate) return null;
  return companyLocalToUtcIso(`${naiveLocalDate}T00:00`);
}

/**
 * Converts a UTC ISO timestamp into the "YYYY-MM-DDTHH:mm" shape a
 * datetime-local input needs, representing Dubai wall-clock time —
 * computed via Intl so it's correct regardless of the browser's own
 * timezone (important for staff/admin editing screens).
 */
export function utcIsoToCompanyLocalInputValue(iso) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Same, but date-only ("YYYY-MM-DD"), for <input type="date"> fields. */
export function utcIsoToCompanyLocalDateValue(iso) {
  return utcIsoToCompanyLocalInputValue(iso).slice(0, 10);
}

/** Formats a UTC ISO timestamp as just the time-of-day in Dubai — for arrival/departure columns. */
export function formatTimeInCompanyTimezone(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: COMPANY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a UTC ISO timestamp as human text in Dubai time — for staff-facing screens/emails. */
export function formatInCompanyTimezone(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: COMPANY_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a UTC ISO timestamp as human text in the VIEWER's own local
 * timezone (whatever the browser is set to) — for guest-facing screens,
 * since a guest planning their day cares about their own local time.
 */
export function formatInViewerLocalTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
