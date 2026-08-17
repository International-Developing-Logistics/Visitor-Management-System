import GuardStation from "@/components/GuardStation";
import { FACILITIES } from "@/lib/facilities";

export default function GuardPage() {
  return <GuardStation facility={FACILITIES.harmony} />;
}
