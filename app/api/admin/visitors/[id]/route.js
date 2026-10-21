import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { isValidVisitorType, sanitizeGroupMembers } from "@/lib/visitorTypes";

const EDITABLE_FIELDS = [
  "full_name",
  "email",
  "phone",
  "company",
  "visitor_type",
  "purpose",
  "host_id",
  "notes",
  "additional_visitor_count",
  "additional_visitor_names",
  "group_members",
];

// PATCH /api/admin/visitors/[id] - edit visitor details. Never deletes
// anything; only updates the fields explicitly sent.
//
// checked_out_at is handled separately from EDITABLE_FIELDS: it's how staff
// fix a premature/accidental check-out. Send an ISO timestamp to set a
// specific checkout time (status is forced to "checked_out"), or an empty
// string/null to undo a checkout entirely (status reverts to "checked_in").
//
// checked_in_at is also handled separately - it's a straight correction of
// the recorded arrival time (e.g. a walk-in kiosk clock was off, or a guard
// logged someone in a few minutes late). Unlike checked_out_at, it can't be
// cleared to null: a visitor who is (or was) checked in always has some
// arrival time on record, so an empty value here is rejected rather than
// treated as "undo".
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if ("checked_in_at" in body) {
    if (!body.checked_in_at) {
      return NextResponse.json({ error: "Check-in time can't be cleared" }, { status: 400 });
    }
    const d = new Date(body.checked_in_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "That check-in time doesn't look valid" }, { status: 400 });
    }
    updates.checked_in_at = d.toISOString();
  }

  if ("checked_out_at" in body) {
    if (body.checked_out_at) {
      const d = new Date(body.checked_out_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "That checkout time doesn't look valid" }, { status: 400 });
      }
      updates.checked_out_at = d.toISOString();
      updates.status = "checked_out";
    } else {
      updates.checked_out_at = null;
      updates.status = "checked_in";
    }
  }

  if ("selected_time_slot" in body) {
    if (body.selected_time_slot) {
      const d = new Date(body.selected_time_slot);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "That meeting time doesn't look valid" }, { status: 400 });
      }
      updates.selected_time_slot = d.toISOString();
    } else {
      updates.selected_time_slot = null;
    }
  }

  // Restricted manual status override - deliberately NOT part of
  // EDITABLE_FIELDS above. Every other status transition in this app
  // already has its own dedicated action with its own side effects
  // (check-in, check-out, gate approve/deny, request approve), so this
  // route doesn't let a caller set status to just anything. The only two
  // values accepted here are the "Did Not Visit" pair added for Automatic
  // Preregistration Tracking (see lib/visitorLifecycle.js): an admin
  // marking a no-show by hand, or undoing one - e.g. the visitor actually
  // showed up, or housekeeping fired too early - by restoring it to
  // "pre_registered" so it can be checked in normally.
  if ("status" in body) {
    const allowedStatuses = ["pre_registered", "did_not_visit"];
    if (!allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "That status can't be set directly here" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  if ("full_name" in updates && !String(updates.full_name || "").trim()) {
    return NextResponse.json({ error: "Full name can't be empty" }, { status: 400 });
  }
  // purpose is intentionally allowed to be empty here - it's assigned by
  // an admin sometime after check-in, so a visitor row with no purpose yet
  // is the normal, expected state, not an error.
  if ("visitor_type" in updates && updates.visitor_type && !isValidVisitorType(updates.visitor_type)) {
    return NextResponse.json({ error: "That visitor type isn't recognized" }, { status: 400 });
  }
  if ("group_members" in updates) {
    updates.group_members = sanitizeGroupMembers(updates.group_members);
    if (updates.group_members.length === 0) updates.group_members = null;
  }
  if ("email" in updates && updates.email) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email);
    if (!emailOk) {
      return NextResponse.json({ error: "That email address doesn't look valid" }, { status: 400 });
    }
  }
  if ("additional_visitor_count" in updates) {
    const n = Number(updates.additional_visitor_count);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Additional visitor count must be 0 or more" }, { status: 400 });
    }
    updates.additional_visitor_count = Math.floor(n);
  }
  if ("email" in updates) updates.email = updates.email || null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("visitors")
    .update(updates)
    .eq("id", params.id)
    .select("*, hosts(name, email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visitor: data });
}
