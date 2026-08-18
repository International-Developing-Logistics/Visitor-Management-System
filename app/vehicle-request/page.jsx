import VehicleRequestForm from "@/components/VehicleRequestForm";
import { FACILITIES } from "@/lib/facilities";

export default function VehicleRequestPage() {
  return <VehicleRequestForm facility={FACILITIES.harmony} />;
}
