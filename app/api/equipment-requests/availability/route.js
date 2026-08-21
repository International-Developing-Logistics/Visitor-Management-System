import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/equipment-requests/availability?facility=idl
// Public — an equipment item is "in use" if it appears in the
// equipment_items array (or legacy `equipment` field) of an approved,
// not-yet-returned request in this facility.
export async function GET(req) {
  const limited = checkRateLimit(req, "equipment-availability");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("equipment_requests")
    .select("equipment, equipment_items, employee_name")
    .eq("facility", facility)
    .eq("status", "approved")
    .is("returned_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inUse = {};
  for (const row of data) {
    const items = row.equipment_items?.length ? row.equipment_items : row.equipment ? [row.equipment] : [];
    for (const item of items) {
      inUse[item] = row.employee_name;
    }
  }

  return NextResponse.json(
    { inUse },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
