import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/admin/vehicle-movements?facility=idl
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("vehicle_movements")
    .select("*")
    .eq("facility", facility)
    .order("checked_out_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoPaths = [];
  for (const row of data) {
    if (row.checkout_photo_url) photoPaths.push(row.checkout_photo_url);
    if (row.checkin_photo_url) photoPaths.push(row.checkin_photo_url);
  }
  const photoMap = await signMany(supabaseAdmin, "vehicle-movement-photos", photoPaths, 600);

  const movements = data.map((m) => ({
    ...m,
    checkout_photo_signed_url: m.checkout_photo_url ? photoMap.get(m.checkout_photo_url) || null : null,
    checkin_photo_signed_url: m.checkin_photo_url ? photoMap.get(m.checkin_photo_url) || null : null,
  }));

  return NextResponse.json(
    { movements },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
