import { getSupabaseAdmin } from "@/lib/supabaseClient";

// Physical equipment units now live in the equipment_units table (see
// supabase/migration_equipment_units.sql) and are managed from
// Admin > Equipment > Print QR Labels, not hardcoded here anymore - these
// two helpers are the one place every server route reads them from, so a
// unit added in the dashboard is immediately visible everywhere (QR
// labels, the checkout kiosk, the guard/admin log).
//
// `id` is what the printed QR code encodes, as /equipment-log/<id> - it
// must be unique and is treated as permanent once a label is printed.
// `facility` is fixed per unit (equipment lives at one location), unlike
// the vehicle fleet, which is shared across both facilities.

export async function getEquipmentUnit(id) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin.from("equipment_units").select("*").eq("id", id).maybeSingle();
  return data || null;
}

// Pass includeInactive: true for admin/management views; everywhere else
// (QR labels, the public browse-all-equipment index) only active units
// should show up.
export async function unitsForFacility(facility, { includeInactive = false } = {}) {
  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin.from("equipment_units").select("*").eq("facility", facility).order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) return [];
  return data;
}
