import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/vehicle-requests/availability?facility=idl
// Public — a vehicle is "in use" if there's an approved request for it in
// this facility that hasn't been marked returned yet. Returns which
// employee has it, so the request form can show a clear message.
export async function GET(req) {
  const limited = checkRateLimit(req, "vehicle-availability");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("vehicle_requests")
    .select("vehicle, employee_name")
    .eq("facility", facility)
    .eq("status", "approved")
    .is("returned_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inUse = {};
  for (const row of data) {
    inUse[row.vehicle] = row.employee_name;
  }

  return NextResponse.json(
    { inUse },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
