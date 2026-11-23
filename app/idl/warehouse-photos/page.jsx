import WarehousePhotosForm from "@/components/WarehousePhotosForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlWarehousePhotosPage() {
  return <WarehousePhotosForm facility={FACILITIES.idl} />;
}
