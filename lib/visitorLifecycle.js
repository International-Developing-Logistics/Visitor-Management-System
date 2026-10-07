// Pure date-math for the "overdue pre-registration" and "stale unanswered
// invite" rules (see VISITOR_FEATURES_DESIGN.md Part 1). Kept separate
// from any Supabase call so it's trivially unit-testable with a fixed
// `now` - the actual row fetch/update/delete lives in
// app/api/admin/visitors/expire-overdue/route.js, which fetches
// candidate rows and asks these functions "is this one due?" one at a
// time rather than re-deriving the cutoff math inline.
//
// The equivalent logic also exists directly in SQL in
// supabase/migration_visitor_did_not_visit.sql, for the optional pg_cron
// job that runs this automatically without needing the app to be awake.
// If the grace periods below ever change, that SQL needs the same change
// made by hand - there's no way to share one implementation between a
// Postgres function and this Node code.
import { utcIsoToCompanyLocalDateValue, companyLocalDateToUtcIso } from "./timezone.js";

export const UNANSWERED_INVITE_GRACE_DAYS = 7;
export const DID_NOT_VISIT_GRACE_DAYS_AFTER_EXPECTED_DAY = 1; // +1 full day after the expected day ends

function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** A visitor's "expected visit date" - whichever of these two is set (see the design doc for why there's no separate column). */
export function expectedVisitIso(visitor) {
  return visitor.selected_time_slot || visitor.proposed_alternative_time || null;
}

/**
 * The instant (UTC ISO) at which a given expected-visit timestamp becomes
 * overdue: the visitor gets their entire expected day in Dubai time, PLUS
 * one more full day of grace, before they're overdue. Example: expected
 * Tuesday -> overdue starting Thursday 00:00 Dubai time, not the instant
 * Tuesday ends.
 */
export function didNotVisitCutoffIso(expectedIso) {
  const expectedDubaiDate = utcIsoToCompanyLocalDateValue(expectedIso);
  const cutoffDubaiDate = addDaysToDateString(expectedDubaiDate, 1 + DID_NOT_VISIT_GRACE_DAYS_AFTER_EXPECTED_DAY);
  return companyLocalDateToUtcIso(cutoffDubaiDate);
}

/**
 * True if this visitor row should be auto-marked "did_not_visit" right
 * now. Only applies to visitors with a CONCRETE expected date
 * (selected_time_slot or proposed_alternative_time) - a pre-registration
 * with neither set has nothing to measure against and is left alone (an
 * admin has to act on it manually), and an "invited" row with no response
 * at all is handled separately by isStaleUnansweredInvite below, not this.
 */
export function isOverdueForDidNotVisit(visitor, now = new Date()) {
  if (visitor.checked_in_at) return false;
  if (visitor.status !== "invited" && visitor.status !== "pre_registered") return false;
  const expected = expectedVisitIso(visitor);
  if (!expected) return false;
  return now.getTime() >= new Date(didNotVisitCutoffIso(expected)).getTime();
}

/**
 * True if this is an "invited" row (a staff invite link that was never
 * completed at all - see app/api/preregister/complete, which always
 * moves status to pre_registered on completion regardless of whether a
 * time slot was picked) old enough to delete outright rather than mark.
 * These rows are deleted, not status-changed, per the explicit "delete
 * after 1 week" requirement - there's deliberately no "did_not_visit"
 * stop along the way for this bucket.
 */
export function isStaleUnansweredInvite(visitor, now = new Date()) {
  if (visitor.status !== "invited") return false;
  const createdAt = new Date(visitor.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  const graceMs = UNANSWERED_INVITE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - createdAt.getTime() >= graceMs;
}
