import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { uploadPrivateFile } from "@/lib/storage";

// POST /api/guard/vehicle-movements/[id]/checkin
//   { checkin_condition_notes?, checkin_photo?, incident_notes? }
// Only an active (not-yet-checked-in) movement can be checked in.
export async function POST(req, { params }) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { checkin_condition_notes, checkin_photo, incident_notes } = await req.json();

  const { data: existing, error: findError } = await supabaseAdmin
    .from("vehicle_movements")
    .select("id, checked_in_at")
    .eq("id", params.id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Movement record not found" }, { status: 404 });
  }
  if (existing.checked_in_at) {
    return NextResponse.json({ error: "This vehicle has already been checked in" }, { status: 409 });
  }

  try {
    const photo_path = checkin_photo
      ? await uploadPrivateFile(supabaseAdmin, "vehicle-movement-photos", `${params.id}-checkin.jpg`, checkin_photo)
      : null;

    const { data: movement, error } = await supabaseAdmin
      .from("vehicle_movements")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.email,
        checkin_condition_notes,
        checkin_photo_url: photo_path,
        incident_notes,
      })
      .eq("id", params.id)
      .is("checked_in_at", null)
      .select()
      .single();

    if (error || !movement) {
      return NextResponse.json({ error: "This vehicle has already been checked in" }, { status: 409 });
    }
    return NextResponse.json({ movement });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
