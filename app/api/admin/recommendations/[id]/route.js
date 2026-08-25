import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const VALID_STATUSES = ["new", "planned", "done", "declined"];

// PATCH /api/admin/recommendations/[id] { status?, admin_notes? }
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, admin_notes } = await req.json();

  const updates = { updated_at: new Date().toISOString() };
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
  }
  if (admin_notes !== undefined) {
    updates.admin_notes = admin_notes;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: recommendation, error } = await supabaseAdmin
    .from("feature_recommendations")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !recommendation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ recommendation });
}
