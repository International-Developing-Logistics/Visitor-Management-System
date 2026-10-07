// Edit this list to match your actual equipment inventory - one entry per
// PHYSICAL UNIT, not per type (replaces the old type-level lib/equipment.js,
// which the request-equipment feature used and which is now retired).
//
// `id` is what the printed QR code encodes, as /equipment-log/<id> - it
// must be unique and should be treated as permanent once a label is
// printed (see app/admin/equipment-log/print-labels). `facility` is fixed
// per unit (equipment lives at one location), unlike the vehicle fleet,
// which is shared across both facilities.
export const EQUIPMENT_UNITS = [
  { id: "pallet-jack-1", name: "Pallet Jack #1", type: "Pallet Jack", facility: "harmony" },
  { id: "forklift-1", name: "Forklift #1", type: "Forklift", facility: "harmony" },
  { id: "reach-truck-1", name: "Reach Truck #1", type: "Reach Truck", facility: "harmony" },
];

export function getEquipmentUnit(id) {
  return EQUIPMENT_UNITS.find((u) => u.id === id) || null;
}

export function unitsForFacility(facility) {
  return EQUIPMENT_UNITS.filter((u) => u.facility === facility);
}
