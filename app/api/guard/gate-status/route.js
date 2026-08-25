import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/guard/gate-status?facility=idl
// A guard's view of gate approvals — name, purpose, status only. This is
// deliberately narrower than /api/admin/visitors (admin-only, full visitor
// records with edit access): guards can see approval outcomes without
// getting broader visitor data or edit capability.
export async function GET(req) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("visitors")
    .select("id, full_name, purpose, status, created_at")
    .eq("facility", facility)
    .in("status", ["gate_pending", "gate_approved", "gate_denied"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visitors: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
