import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// PATCH /api/admin/vehicle-movements/[id]
//   { checked_out_at?: ISO string, checked_in_at?: ISO string | "" }
// Times are auto-recorded by guards, but authorized (admin) users can
// correct them here if needed.
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};

  if ("checked_out_at" in body) {
    if (!body.checked_out_at) {
      return NextResponse.json({ error: "Check-out time can't be cleared" }, { status: 400 });
    }
    const d = new Date(body.checked_out_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "That check-out time doesn't look valid" }, { status: 400 });
    }
    updates.checked_out_at = d.toISOString();
  }

  if ("checked_in_at" in body) {
    if (body.checked_in_at) {
      const d = new Date(body.checked_in_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "That check-in time doesn't look valid" }, { status: 400 });
      }
      updates.checked_in_at = d.toISOString();
    } else {
      // Clearing check-in time reopens the movement (vehicle becomes "out" again).
      updates.checked_in_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("vehicle_movements")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movement: data });
}
