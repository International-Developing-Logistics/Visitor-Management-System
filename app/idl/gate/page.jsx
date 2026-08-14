import GateForm from "@/components/GateForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlGatePage() {
  return <GateForm facility={FACILITIES.idl} />;
}
