import GateCheckForm from "@/components/GateCheckForm";
import { FACILITIES } from "@/lib/facilities";

export default function GateCheckFormPage() {
  return <GateCheckForm facility={FACILITIES.harmony} />;
}
