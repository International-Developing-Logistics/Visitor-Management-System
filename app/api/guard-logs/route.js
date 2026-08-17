import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireStaff } from "@/lib/verifyAdmin";
import { uploadPrivateFile, signMany } from "@/lib/storage";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

// GET /api/guard-logs?facility=idl — today's log entries for that facility,
// newest first, with a signed URL for each vehicle plate photo. Used by
// both the guard station page and the admin dashboard.
export async function GET(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const { data, error } = await supabaseAdmin
    .from("guard_logs")
    .select("*")
    .eq("facility", facility)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoMap = await signMany(
    supabaseAdmin,
    "vehicle-plates",
    data.map((g) => g.vehicle_plate_photo_url),
    600
  );

  const logs = data.map((g) => ({
    ...g,
    vehicle_plate_photo_signed_url: g.vehicle_plate_photo_url ? photoMap.get(g.vehicle_plate_photo_url) || null : null,
  }));

  return NextResponse.json(
    { logs },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// POST /api/guard-logs — a guard logs a new vehicle/visitor entry.
export async function POST(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { visitor_name, phone, company, car_type, vehicle_plate_photo, facility } = await req.json();

  if (!visitor_name) {
    return NextResponse.json({ error: "Visitor name is required" }, { status: 400 });
  }
  if (car_type && !["sedan", "suv", "van", "semi-truck"].includes(car_type)) {
    return NextResponse.json({ error: "Invalid car type" }, { status: 400 });
  }

  try {
    const id = randomUUID();
    const photo_path = vehicle_plate_photo
      ? await uploadPrivateFile(supabaseAdmin, "vehicle-plates", `${id}.jpg`, vehicle_plate_photo)
      : null;

    const { data: log, error } = await supabaseAdmin
      .from("guard_logs")
      .insert({
        id,
        facility: facility || DEFAULT_FACILITY,
        visitor_name,
        phone,
        company,
        car_type: car_type || null,
        vehicle_plate_photo_url: photo_path,
        logged_by_email: user.email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ log });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
