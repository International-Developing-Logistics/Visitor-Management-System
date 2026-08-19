import EquipmentRequestForm from "@/components/EquipmentRequestForm";
import { FACILITIES } from "@/lib/facilities";

export default function EquipmentRequestPage() {
  return <EquipmentRequestForm facility={FACILITIES.harmony} />;
}
