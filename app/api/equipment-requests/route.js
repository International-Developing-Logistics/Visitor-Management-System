import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// POST /api/equipment-requests
//   { employee_name, equipment_items?: string[], external_rental_request?: string,
//     location, needed_from, needed_until, facility? }
// At least one of equipment_items or external_rental_request is required.
// needed_from/needed_until are required unless it's a rental request.
// No email notification on submission (unlike gate/vehicle requests) —
// this workflow is reviewed purely from /admin/equipment-requests.
// Public/no-login by design — see HANDOVER.md §1.4.
export async function POST(req) {
  const limited = checkRateLimit(req, "equipment-requests");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { employee_name, equipment_items, external_rental_request, location, needed_from, needed_until, facility } =
    await req.json();

  const items = Array.isArray(equipment_items) ? equipment_items.filter(Boolean) : [];
  const rental = external_rental_request?.trim() || null;

  if (!employee_name || (items.length === 0 && !rental)) {
    return NextResponse.json(
      { error: "Select at least one item, or describe what you need rented" },
      { status: 400 }
    );
  }

  if (!rental) {
    if (!needed_from || !needed_until) {
      return NextResponse.json({ error: "Please select when the equipment is needed" }, { status: 400 });
    }
    if (new Date(needed_until) <= new Date(needed_from)) {
      return NextResponse.json({ error: "'Needed until' must be after 'Needed from'" }, { status: 400 });
    }
  }

  const facilityKey = facility || DEFAULT_FACILITY;

  // Server-side backstop for Rule B, same pattern as vehicle requests —
  // re-check every selected item is still available at submission time.
  if (items.length > 0) {
    const { data: inUseRows } = await supabaseAdmin
      .from("equipment_requests")
      .select("equipment, equipment_items, employee_name")
      .eq("facility", facilityKey)
      .eq("status", "approved")
      .is("returned_at", null);

    const inUseMap = {};
    for (const row of inUseRows || []) {
      const rowItems = row.equipment_items?.length ? row.equipment_items : row.equipment ? [row.equipment] : [];
      for (const it of rowItems) inUseMap[it] = row.employee_name;
    }

    for (const item of items) {
      if (inUseMap[item]) {
        return NextResponse.json(
          { error: `${inUseMap[item]} is currently using this vehicle/equipment.` },
          { status: 409 }
        );
      }
    }
  }

  const { data: request, error } = await supabaseAdmin
    .from("equipment_requests")
    .insert({
      employee_name,
      equipment_items: items.length > 0 ? items : null,
      external_rental_request: rental,
      location,
      needed_from: rental ? null : needed_from,
      needed_until: rental ? null : needed_until,
      status: "pending",
      facility: facilityKey,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request });
}
