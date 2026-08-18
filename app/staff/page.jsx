import StaffHub from "@/components/StaffHub";
import { FACILITIES } from "@/lib/facilities";

export default function StaffPage() {
  return <StaffHub facility={FACILITIES.harmony} />;
}
