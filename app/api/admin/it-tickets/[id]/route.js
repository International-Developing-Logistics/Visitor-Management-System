import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];

// PATCH /api/admin/it-tickets/[id] { status?, admin_notes? }
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
  const { data: ticket, error } = await supabaseAdmin
    .from("it_tickets")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}
