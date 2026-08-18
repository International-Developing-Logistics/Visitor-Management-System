import StaffHub from "@/components/StaffHub";
import { FACILITIES } from "@/lib/facilities";

export default function IdlStaffPage() {
  return <StaffHub facility={FACILITIES.idl} />;
}
