import VehicleRequestForm from "@/components/VehicleRequestForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlVehicleRequestPage() {
  return <VehicleRequestForm facility={FACILITIES.idl} />;
}
