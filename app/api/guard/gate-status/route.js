import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/guard/gate-status?facility=idl
// A guard's view of visitors — name, purpose, status only. This is
// deliberately narrower than /api/admin/visitors (admin-only, full visitor
// records with edit access): guards can see the same Expected/At Gate/On
// Site/Completed picture as the admin Visitors page, without getting
// broader visitor data (email, host, company) or edit capability. Widened
// from gate-only statuses to the full set so the Security dashboard's
// gate-focused home can show who's expected and on site too, not just
// who's physically at the gate right now.
export async function GET(req) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("visitors")
    .select("id, full_name, purpose, status, created_at")
    .eq("facility", facility)
    .in("status", [
      "invited",
      "pre_registered",
      "requested",
      "gate_pending",
      "gate_approved",
      "checked_in",
      "checked_out",
      "gate_denied",
    ])
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visitors: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
