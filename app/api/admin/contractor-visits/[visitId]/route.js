import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// PATCH /api/admin/contractor-visits/[visitId]
//   { checked_in_at?: ISO string, checked_out_at?: ISO string | "" }
// Check-in/out times are recorded automatically by the check-in/check-out
// buttons, but admins can correct a mistaken entry here — same idea as
// PATCH /api/admin/vehicle-movements/[id]. checked_in_at can't be cleared
// (a visit always has one); clearing checked_out_at reopens the visit
// (the contractor becomes "on site" again).
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};

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
        return NextResponse.json({ error: "That check-out time doesn't look valid" }, { status: 400 });
      }
      updates.checked_out_at = d.toISOString();
    } else {
      // Clearing check-out time reopens the visit.
      updates.checked_out_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("contractor_visits")
    .select("contractor_id, checked_in_at, checked_out_at")
    .eq("id", params.visitId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const finalCheckedInAt = updates.checked_in_at || existing.checked_in_at;
  const finalCheckedOutAt = "checked_out_at" in updates ? updates.checked_out_at : existing.checked_out_at;

  if (finalCheckedOutAt && new Date(finalCheckedOutAt) < new Date(finalCheckedInAt)) {
    return NextResponse.json({ error: "Check-out time can't be before check-in time" }, { status: 400 });
  }

  // Reopening a visit (clearing checked_out_at) would leave this
  // contractor with two "open" rows if another one is already open —
  // block that rather than silently breaking the single-open-visit
  // assumption the check-in/check-out buttons rely on.
  if ("checked_out_at" in updates && updates.checked_out_at === null && existing.checked_out_at !== null) {
    const { data: otherOpen } = await supabaseAdmin
      .from("contractor_visits")
      .select("id")
      .eq("contractor_id", existing.contractor_id)
      .is("checked_out_at", null)
      .neq("id", params.visitId)
      .limit(1);
    if (otherOpen && otherOpen.length > 0) {
      return NextResponse.json(
        { error: "This contractor already has a different open visit — close that one first" },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("contractor_visits")
    .update(updates)
    .eq("id", params.visitId)
    .select("*, contractor:contractors(full_name, company, pass_id, status)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visit: data });
}
