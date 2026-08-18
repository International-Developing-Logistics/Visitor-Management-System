import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendVehicleRequestApprovalEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getFacility, DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

// POST /api/vehicle-requests { employee_name, vehicle, destination, estimated_time, facility? }
export async function POST(req) {
  const limited = checkRateLimit(req, "vehicle-requests");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { employee_name, vehicle, destination, estimated_time, facility } = await req.json();

  if (!employee_name || !vehicle || !destination) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const facilityKey = facility || DEFAULT_FACILITY;
  const approval_token = randomUUID();

  const { data: request, error } = await supabaseAdmin
    .from("vehicle_requests")
    .insert({
      employee_name,
      vehicle,
      destination,
      estimated_time,
      status: "pending",
      approval_token,
      facility: facilityKey,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = req.nextUrl.origin;
  const approveUrl = `${origin}/api/vehicle-requests/approve?token=${approval_token}&action=approve`;
  const rejectUrl = `${origin}/api/vehicle-requests/approve?token=${approval_token}&action=reject`;

  try {
    const facilityLabel = facilityKey !== DEFAULT_FACILITY ? getFacility(facilityKey).label : undefined;
    await sendVehicleRequestApprovalEmail({ request, approveUrl, rejectUrl, facilityLabel });
  } catch (err) {
    console.error("[vehicle-requests] approval email failed:", err.message);
    // Don't fail the submission just because the email had trouble — the
    // request is still visible/approvable from /admin.
  }

  return NextResponse.json({ request });
}
