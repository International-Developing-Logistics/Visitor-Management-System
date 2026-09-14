import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { getEquipmentUnit, unitsForFacility } from "@/lib/equipmentUnits";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/equipment-log?unit=<unitId>          -> status for one unit
// GET /api/equipment-log?facility=idl           -> status for every unit at that facility
// Public, no login — this backs both the QR-scan landing page and the
// "browse all equipment" index linked from the Staff Hub.
export async function GET(req) {
  const supabaseAdmin = getSupabaseAdmin();
  const unitId = req.nextUrl.searchParams.get("unit");

  if (unitId) {
    const unit = getEquipmentUnit(unitId);
    if (!unit) return NextResponse.json({ error: "Unknown equipment QR code." }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("equipment_movements")
      .select("id, user_name, checked_out_at")
      .eq("unit_id", unitId)
      .is("checked_in_at", null)
      .order("checked_out_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      { unit, active: data || null },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const units = unitsForFacility(facility);

  const { data: activeRows, error } = await supabaseAdmin
    .from("equipment_movements")
    .select("unit_id, user_name, checked_out_at")
    .in("unit_id", units.map((u) => u.id))
    .is("checked_in_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activeByUnit = new Map(activeRows.map((r) => [r.unit_id, r]));
  const list = units.map((u) => ({ ...u, active: activeByUnit.get(u.id) || null }));

  return NextResponse.json(
    { units: list },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// POST /api/equipment-log { unit_id, user_name, facility } — record a
// checkout (pickup). Public, no login — matches the trust model used by
// every other guest/employee-facing form in this app (see HANDOVER.md
// §1.4): the resulting entry is visible to admin/guard immediately.
export async function POST(req) {
  const limited = checkRateLimit(req, "equipment-log");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { unit_id, user_name, facility } = await req.json();

  if (!unit_id || !user_name?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const unit = getEquipmentUnit(unit_id);
  if (!unit) return NextResponse.json({ error: "Unknown equipment QR code." }, { status: 404 });

  // Server-side backstop for the two-scan lifecycle — the UI only ever
  // shows the "pick up" form when the unit isn't already out, but
  // re-check here too in case of a race (two people scanning the same
  // unit within the same second).
  const { data: activeRows } = await supabaseAdmin
    .from("equipment_movements")
    .select("user_name")
    .eq("unit_id", unit_id)
    .is("checked_in_at", null)
    .limit(1);

  if (activeRows && activeRows.length > 0) {
    return NextResponse.json(
      { error: `This equipment is already checked out to ${activeRows[0].user_name}.` },
      { status: 409 }
    );
  }

  const { data: movement, error } = await supabaseAdmin
    .from("equipment_movements")
    .insert({
      facility: facility || unit.facility,
      unit_id: unit.id,
      unit_name: unit.name,
      equipment_type: unit.type,
      user_name: user_name.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movement });
}
