import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";

// POST /api/admin/gate/[id]/decide { action: "approve" | "deny" | "revert" }
// approve/deny: same effect as clicking the email link, from the dashboard
// — open to guards too (not just admin) so a guard can decide a walk-in
// directly from the Security dashboard instead of waiting on an email
// link or an admin. This is no more permissive than the email link itself
// (which needs no auth at all), and the response is just the one visitor
// row being decided.
// revert: undoes an approve/deny back to "awaiting approval" — for fixing
// a mis-click, since the email links themselves are one-way.
export async function POST(req, { params }) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["approve", "deny", "revert"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (action === "revert") {
    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .update({ status: "gate_pending" })
      .eq("id", params.id)
      .in("status", ["gate_approved", "gate_denied"])
      .select()
      .single();

    if (error || !visitor) {
      return NextResponse.json({ error: "Not found or nothing to revert" }, { status: 404 });
    }
    return NextResponse.json({ visitor });
  }

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
