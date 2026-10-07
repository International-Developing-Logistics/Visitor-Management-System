import ITTicketForm from "@/components/ITTicketForm";
import { FACILITIES } from "@/lib/facilities";

export default function IdlITTicketsPage() {
  return <ITTicketForm facility={FACILITIES.idl} />;
}
