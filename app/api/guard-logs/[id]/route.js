import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";

// PATCH /api/guard-logs/[id] { checked_out_at? }
// Sends an ISO timestamp to set checkout time, or "" to clear it (undo an
// accidental checkout). Omit the field entirely to just checkout "now".
export async function PATCH(req, { params }) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates = {};

  if ("checked_out_at" in body) {
    if (body.checked_out_at) {
      const d = new Date(body.checked_out_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "That checkout time doesn't look valid" }, { status: 400 });
      }
      updates.checked_out_at = d.toISOString();
    } else {
      updates.checked_out_at = null;
    }
  } else {
    updates.checked_out_at = new Date().toISOString();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("guard_logs")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
