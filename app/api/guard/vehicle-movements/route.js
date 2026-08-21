import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireStaff } from "@/lib/verifyAdmin";
import { uploadPrivateFile, signMany } from "@/lib/storage";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

// GET /api/guard/vehicle-movements?facility=idl&view=active|history
// view=active (default): only currently-checked-out vehicles.
// view=history: every movement record, active or completed.
export async function GET(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const view = req.nextUrl.searchParams.get("view") || "active";

  let query = supabaseAdmin
    .from("vehicle_movements")
    .select("*")
    .eq("facility", facility)
    .order("checked_out_at", { ascending: false })
    .limit(200);

  if (view === "active") query = query.is("checked_in_at", null);

  const { data, error } = await query;
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

// POST /api/guard/vehicle-movements — record a check-out.
export async function POST(req) {
  const user = await requireStaff(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { vehicle, license_plate, driver_name, destination, checkout_condition_notes, checkout_photo, facility } =
    await req.json();

  if (!vehicle || !license_plate || !driver_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const facilityKey = facility || DEFAULT_FACILITY;

  // Rule: a vehicle can only be checked out if currently available.
  // Server-side backstop — the UI already disables an already-out vehicle.
  const { data: activeRows } = await supabaseAdmin
    .from("vehicle_movements")
    .select("driver_name")
    .eq("facility", facilityKey)
    .eq("vehicle", vehicle)
    .is("checked_in_at", null)
    .limit(1);

  if (activeRows && activeRows.length > 0) {
    return NextResponse.json(
      { error: `This vehicle is already checked out to ${activeRows[0].driver_name}.` },
      { status: 409 }
    );
  }

  try {
    const id = randomUUID();
    const photo_path = checkout_photo
      ? await uploadPrivateFile(supabaseAdmin, "vehicle-movement-photos", `${id}-checkout.jpg`, checkout_photo)
      : null;

    const { data: movement, error } = await supabaseAdmin
      .from("vehicle_movements")
      .insert({
        id,
        facility: facilityKey,
        vehicle,
        license_plate,
        driver_name,
        destination,
        checkout_condition_notes,
        checkout_photo_url: photo_path,
        checked_out_by: user.email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ movement });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
