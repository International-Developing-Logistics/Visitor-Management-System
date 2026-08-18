import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// POST /api/admin/vehicle-requests/[id]/decide { action: "approve" | "reject" | "revert" }
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["approve", "reject", "revert"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (action === "revert") {
    const { data: request, error } = await supabaseAdmin
      .from("vehicle_requests")
      .update({ status: "pending", decided_at: null })
      .eq("id", params.id)
      .in("status", ["approved", "rejected"])
      .select()
      .single();

    if (error || !request) {
      return NextResponse.json({ error: "Not found or nothing to revert" }, { status: 404 });
    }
    return NextResponse.json({ request });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const { data: request, error } = await supabaseAdmin
    .from("vehicle_requests")
    .update({ status: newStatus, decided_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error || !request) {
    return NextResponse.json({ error: "Not found or already decided" }, { status: 404 });
  }

  return NextResponse.json({ request });
}
