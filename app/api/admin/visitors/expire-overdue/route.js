import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { isOverdueForDidNotVisit, isStaleUnansweredInvite } from "@/lib/visitorLifecycle";

// POST /api/admin/visitors/expire-overdue - requireAdmin. Runs the same two
// housekeeping rules the optional pg_cron jobs in
// supabase/migration_visitor_did_not_visit.sql apply automatically, but on
// demand - this is what the "Run visitor housekeeping now" button on the
// admin Visitors page calls, and it's the only way this logic runs at all
// for anyone who hasn't enabled the pg_cron extension on their Supabase
// project. See lib/visitorLifecycle.js for the shared (pure, testable)
// date logic this mirrors - keep both in sync by hand if the grace periods
// ever change there.
//
// Two independent passes, matching the two different stale states:
// 1. invited/pre_registered visitors with a concrete expected date who
//    never checked in, once it's 2+ calendar days past that date (Dubai
//    time) -> marked "did_not_visit" (kept, not deleted - still a real
//    record admins may want to review or restore).
// 2. "invited" rows nobody ever responded to at all, once they're a week
//    old -> deleted outright (never a real visit, just an unanswered invite).
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from("visitors")
    .select("id, status, created_at, checked_in_at, selected_time_slot, proposed_alternative_time")
    .in("status", ["invited", "pre_registered"]);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const now = new Date();
  const didNotVisitIds = [];
  const staleInviteIds = [];

  for (const v of candidates || []) {
    // A stale unanswered invite is checked first: an "invited" row never
    // has a concrete expected date in the first place (that's only ever
    // set on completion, which simultaneously moves status to
    // "pre_registered" - see lib/visitorLifecycle.js), so the two buckets
    // never actually overlap, but checking in this order keeps that
    // guarantee explicit rather than relying on it silently.
    if (isStaleUnansweredInvite(v, now)) {
      staleInviteIds.push(v.id);
    } else if (isOverdueForDidNotVisit(v, now)) {
      didNotVisitIds.push(v.id);
    }
  }

  let markedCount = 0;
  let deletedCount = 0;

  if (didNotVisitIds.length > 0) {
    const { error, data } = await supabaseAdmin
      .from("visitors")
      .update({ status: "did_not_visit" })
      .in("id", didNotVisitIds)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    markedCount = data?.length ?? didNotVisitIds.length;
  }

  if (staleInviteIds.length > 0) {
    const { error, data } = await supabaseAdmin
      .from("visitors")
      .delete()
      .in("id", staleInviteIds)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    deletedCount = data?.length ?? staleInviteIds.length;
  }

  return NextResponse.json({ markedDidNotVisit: markedCount, deletedStaleInvites: deletedCount });
}
