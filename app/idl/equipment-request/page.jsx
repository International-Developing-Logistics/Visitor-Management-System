import EquipmentRequestForm from "@/components/EquipmentRequestForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlEquipmentRequestPage() {
  return <EquipmentRequestForm facility={FACILITIES.idl} />;
}
