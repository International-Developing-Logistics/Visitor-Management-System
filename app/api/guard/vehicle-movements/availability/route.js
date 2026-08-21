import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireStaff } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/guard/vehicle-movements/availability?facility=idl
// A vehicle TYPE is "out" if there's a movement record for it in this
// facility with no checked_in_at yet. Returns driver name so the checkout
// form can show who currently has it.
export async function GET(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("vehicle_movements")
    .select("vehicle, driver_name, license_plate")
    .eq("facility", facility)
    .is("checked_in_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out = {};
  for (const row of data) {
    out[row.vehicle] = { driver_name: row.driver_name, license_plate: row.license_plate };
  }

  return NextResponse.json(
    { out },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
