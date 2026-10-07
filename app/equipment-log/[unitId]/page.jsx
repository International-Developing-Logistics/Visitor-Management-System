import EquipmentLogForm from "@/components/EquipmentLogForm";

// What the printed QR code on each piece of equipment points to - see
// app/admin/equipment-log/print-labels for the labels themselves and
// lib/equipmentUnits.js for the unit list. No facility segment in this
// route: the unit's own facility (baked into lib/equipmentUnits.js) is
// resolved server-side by the form's status fetch.
export default function EquipmentLogPage({ params }) {
  return <EquipmentLogForm unitId={params.unitId} />;
}
