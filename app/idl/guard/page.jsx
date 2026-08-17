import GuardStation from "@/components/GuardStation";
import { FACILITIES } from "@/lib/facilities";

export default function IdlGuardPage() {
  return <GuardStation facility={FACILITIES.idl} />;
}
