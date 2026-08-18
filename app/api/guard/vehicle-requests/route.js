import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireStaff } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/guard/vehicle-requests?facility=idl
// Read-only for guards — enough detail to verify a request before
// releasing a vehicle, no approve/reject capability (that's admin-only).
export async function GET(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("vehicle_requests")
    .select("*")
    .eq("facility", facility)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { requests: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
