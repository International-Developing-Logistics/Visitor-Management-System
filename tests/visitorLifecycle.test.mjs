// Run with: npm test (node --test tests/)
//
// Covers the pure date-math in lib/visitorLifecycle.js - the shared logic
// behind Automatic Preregistration Tracking, used both by the on-demand
// "Run visitor housekeeping now" admin route
// (app/api/admin/visitors/expire-overdue) and documented as the reference
// behavior for the optional pg_cron jobs in
// supabase/migration_visitor_did_not_visit.sql.
//
// lib/ has its own package.json with {"type":"module"} so these ESM
// `import`/`export` files can be loaded directly by Node's test runner
// without needing a build step or changing the rest of the (CommonJS-by-
// default) project.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  UNANSWERED_INVITE_GRACE_DAYS,
  DID_NOT_VISIT_GRACE_DAYS_AFTER_EXPECTED_DAY,
  expectedVisitIso,
  didNotVisitCutoffIso,
  isOverdueForDidNotVisit,
  isStaleUnansweredInvite,
} from "../lib/visitorLifecycle.js";
import { utcIsoToCompanyLocalDateValue, companyLocalDateToUtcIso } from "../lib/timezone.js";

describe("expectedVisitIso", () => {
  test("prefers selected_time_slot over proposed_alternative_time", () => {
    const iso = expectedVisitIso({
      selected_time_slot: "2026-01-10T10:00:00.000Z",
      proposed_alternative_time: "2026-01-12T10:00:00.000Z",
    });
    assert.equal(iso, "2026-01-10T10:00:00.000Z");
  });

  test("falls back to proposed_alternative_time when no selected slot", () => {
    const iso = expectedVisitIso({
      selected_time_slot: null,
      proposed_alternative_time: "2026-01-12T10:00:00.000Z",
    });
    assert.equal(iso, "2026-01-12T10:00:00.000Z");
  });

  test("returns null when neither is set", () => {
    assert.equal(expectedVisitIso({ selected_time_slot: null, proposed_alternative_time: null }), null);
  });
});

describe("didNotVisitCutoffIso", () => {
  test("cutoff is exactly 2 calendar Dubai days after the expected date, at Dubai midnight", () => {
    const expectedIso = "2026-03-15T06:00:00.000Z"; // 2026-03-15T10:00 Dubai
    const expectedDubaiDate = utcIsoToCompanyLocalDateValue(expectedIso); // "2026-03-15"

    // Independently re-derive the expected cutoff date string (1 day for
    // the expected day to fully elapse + the configured grace days) using
    // plain UTC date arithmetic on the calendar string, rather than
    // reusing visitorLifecycle's own internal helper - so this test can
    // actually catch a regression there instead of just restating it.
    const [y, m, d] = expectedDubaiDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1 + DID_NOT_VISIT_GRACE_DAYS_AFTER_EXPECTED_DAY);
    const expectedCutoffDate = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

    const expectedCutoffIso = companyLocalDateToUtcIso(expectedCutoffDate);
    assert.equal(didNotVisitCutoffIso(expectedIso), expectedCutoffIso);
  });
});

describe("isOverdueForDidNotVisit", () => {
  const baseVisitor = {
    status: "pre_registered",
    checked_in_at: null,
    selected_time_slot: "2026-03-15T06:00:00.000Z",
    proposed_alternative_time: null,
  };

  test("false once the visitor has actually checked in", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    assert.equal(isOverdueForDidNotVisit({ ...baseVisitor, checked_in_at: "2026-03-15T07:00:00.000Z" }, now), false);
  });

  test("false for a status this rule doesn't apply to", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    assert.equal(isOverdueForDidNotVisit({ ...baseVisitor, status: "checked_out" }, now), false);
  });

  test("false when there's no expected date at all (e.g. an unanswered invite)", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    assert.equal(
      isOverdueForDidNotVisit(
        { ...baseVisitor, status: "invited", selected_time_slot: null, proposed_alternative_time: null },
        now
      ),
      false
    );
  });

  test("false before the cutoff has passed", () => {
    const cutoff = new Date(didNotVisitCutoffIso(baseVisitor.selected_time_slot));
    const justBefore = new Date(cutoff.getTime() - 1000);
    assert.equal(isOverdueForDidNotVisit(baseVisitor, justBefore), false);
  });

  test("true once the cutoff has passed", () => {
    const cutoff = new Date(didNotVisitCutoffIso(baseVisitor.selected_time_slot));
    assert.equal(isOverdueForDidNotVisit(baseVisitor, cutoff), true);
    assert.equal(isOverdueForDidNotVisit(baseVisitor, new Date(cutoff.getTime() + 1000)), true);
  });
});

describe("isStaleUnansweredInvite", () => {
  test(`false for anything other than "invited"`, () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    assert.equal(isStaleUnansweredInvite({ status: "pre_registered", created_at: "2026-01-01T00:00:00.000Z" }, now), false);
  });

  test("false for an invite that isn't old enough yet", () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const now = new Date(createdAt.getTime() + (UNANSWERED_INVITE_GRACE_DAYS * 24 * 60 * 60 * 1000) - 1000);
    assert.equal(isStaleUnansweredInvite({ status: "invited", created_at: createdAt.toISOString() }, now), false);
  });

  test("true once the invite is at least the grace period old", () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const now = new Date(createdAt.getTime() + UNANSWERED_INVITE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    assert.equal(isStaleUnansweredInvite({ status: "invited", created_at: createdAt.toISOString() }, now), true);
  });

  test("false (not thrown) for a malformed created_at", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    assert.equal(isStaleUnansweredInvite({ status: "invited", created_at: "not-a-date" }, now), false);
  });
});
