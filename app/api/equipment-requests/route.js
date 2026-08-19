import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// POST /api/equipment-requests { employee_name, equipment, location, estimated_time, facility? }
// No email notification on submission (unlike gate/vehicle requests) —
// this workflow is reviewed purely from /admin/equipment-requests. Ask if
// you'd like an admin-notification email added here later.
export async function POST(req) {
  const limited = checkRateLimit(req, "equipment-requests");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { employee_name, equipment, location, estimated_time, facility } = await req.json();

  if (!employee_name || !equipment) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: request, error } = await supabaseAdmin
    .from("equipment_requests")
    .insert({
      employee_name,
      equipment,
      location,
      estimated_time,
      status: "pending",
      facility: facility || DEFAULT_FACILITY,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request });
}
