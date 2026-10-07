import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { uploadPrivateFile } from "@/lib/storage";

// POST /api/equipment-log/[id]/checkin
// { hour_meter_photo, damaged, damage_photo, damage_notes }
// Records the return scan: a photo of the motor hour counter is always
// required; a damage photo is required only if `damaged` is checked.
// Public, no login - same trust model as the checkout POST above.
export async function POST(req, { params }) {
  const limited = checkRateLimit(req, "equipment-log");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { id } = params;
  const { hour_meter_photo, damaged, damage_photo, damage_notes } = await req.json();

  if (!hour_meter_photo) {
    return NextResponse.json({ error: "Please take a photo of the motor hour counter." }, { status: 400 });
  }
  if (damaged && !damage_photo) {
    return NextResponse.json({ error: "Please take a photo of the damage." }, { status: 400 });
  }

  const { data: movement, error: fetchError } = await supabaseAdmin
    .from("equipment_movements")
    .select("id, checked_in_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!movement) return NextResponse.json({ error: "Checkout record not found." }, { status: 404 });
  if (movement.checked_in_at) {
    return NextResponse.json({ error: "This equipment has already been checked in." }, { status: 409 });
  }

  try {
    const hourMeterPath = await uploadPrivateFile(
      supabaseAdmin,
      "equipment-log-photos",
      `${id}-hours.jpg`,
      hour_meter_photo
    );
    const damagePath = damaged && damage_photo
      ? await uploadPrivateFile(supabaseAdmin, "equipment-log-photos", `${id}-damage.jpg`, damage_photo)
      : null;

    const { data: updated, error } = await supabaseAdmin
      .from("equipment_movements")
      .update({
        checked_in_at: new Date().toISOString(),
        hour_meter_photo_url: hourMeterPath,
        damaged: !!damaged,
        damage_photo_url: damagePath,
        damage_notes: damaged ? (damage_notes || null) : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ movement: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
