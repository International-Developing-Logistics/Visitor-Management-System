import PreregisterOpenForm from "@/components/PreregisterOpenForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlPreregisterOpenPage() {
  return <PreregisterOpenForm facility={FACILITIES.idl} />;
}
