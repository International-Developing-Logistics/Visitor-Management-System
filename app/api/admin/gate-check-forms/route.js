import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/admin/gate-check-forms?facility=harmony|idl|all
// Admin or guard (requireAdminOrGuard) - same tier as every other
// gate/security list in this app. Summary columns only; the detail view
// (GET .../[id]) is what resolves signed URLs for signatures/photos.
export async function GET(req) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  let query = supabaseAdmin
    .from("gate_check_forms")
    .select("id, facility, form_no, container_no, truck_plate, driver_name, decision, check_date, submitted_by_email, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (facility !== "all") query = query.eq("facility", facility);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ forms: data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
