import ITTicketForm from "@/components/ITTicketForm";
import { FACILITIES } from "@/lib/facilities";

export default function ITTicketsPage() {
  return <ITTicketForm facility={FACILITIES.harmony} />;
}
