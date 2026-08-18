import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// POST /api/admin/vehicle-requests/[id]/decide { action: "approve" | "reject" }
// Same effect as clicking the email link, from the dashboard instead.
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
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
