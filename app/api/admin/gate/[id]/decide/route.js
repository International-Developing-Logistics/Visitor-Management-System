import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// POST /api/admin/gate/[id]/decide { action: "approve" | "deny" }
// Same effect as clicking the Approve/Deny link in the gate email, just
// from the dashboard directly.
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const newStatus = action === "approve" ? "gate_approved" : "gate_denied";

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .update({ status: newStatus })
    .eq("id", params.id)
    .eq("status", "gate_pending")
    .select()
    .single();

  if (error || !visitor) {
    return NextResponse.json({ error: "Not found or already decided" }, { status: 404 });
  }

  return NextResponse.json({ visitor });
}
