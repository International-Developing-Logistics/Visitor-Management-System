import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/guard/equipment-log?facility=idl&view=active|history
// Read-only for both admin and guard (requireAdminOrGuard) — there's no
// decide/action step here (unlike equipment_requests), so one endpoint
// serves both the admin Equipment > Log page and the guard dashboard's
// Equipment Log tab, same shared-endpoint approach already used for
// vehicle_movements between guard and admin.
export async function GET(req) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const view = req.nextUrl.searchParams.get("view") || "active";

  let query = supabaseAdmin
    .from("equipment_movements")
    .select("*")
    .eq("facility", facility)
    .order("checked_out_at", { ascending: false })
    .limit(200);

  if (view === "active") query = query.is("checked_in_at", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoPaths = [];
  for (const row of data) {
    if (row.hour_meter_photo_url) photoPaths.push(row.hour_meter_photo_url);
    if (row.damage_photo_url) photoPaths.push(row.damage_photo_url);
  }
  const photoMap = await signMany(supabaseAdmin, "equipment-log-photos", photoPaths, 600);

  const movements = data.map((m) => ({
    ...m,
    hour_meter_photo_signed_url: m.hour_meter_photo_url ? photoMap.get(m.hour_meter_photo_url) || null : null,
    damage_photo_signed_url: m.damage_photo_url ? photoMap.get(m.damage_photo_url) || null : null,
  }));

  return NextResponse.json(
    { movements },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
