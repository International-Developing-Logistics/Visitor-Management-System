import GateCheckForm from "@/components/GateCheckForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlGateCheckFormPage() {
  return <GateCheckForm facility={FACILITIES.idl} />;
}
