import WarehousePhotosForm from "@/components/WarehousePhotosForm";
import { FACILITIES } from "@/lib/facilities";

export default function WarehousePhotosPage() {
  return <WarehousePhotosForm facility={FACILITIES.harmony} />;
}
