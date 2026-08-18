import ServiceHub from "@/components/ServiceHub";
import { FACILITIES } from "@/lib/facilities";

export default function IdlHome() {
  return <ServiceHub facility={FACILITIES.idl} />;
}
