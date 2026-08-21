import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendVehicleRequestApprovalEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getFacility, DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

// POST /api/vehicle-requests
//   Normal:   { employee_name, vehicle, destination, estimated_time, facility? }
//   External: { is_external: true, customer_name, destination, facility? }
export async function POST(req) {
  const limited = checkRateLimit(req, "vehicle-requests");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { employee_name, vehicle, destination, estimated_time, is_external, customer_name, facility } =
    await req.json();

  if (!destination || !employee_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const facilityKey = facility || DEFAULT_FACILITY;

  if (is_external) {
    if (!customer_name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
  } else {
    if (!vehicle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Server-side backstop for Rule B — the UI already blocks selecting an
    // in-use vehicle, but re-check here too in case of a race condition or
    // a bypassed client. Doesn't apply to external requests, since those
    // aren't drawn from our own fleet.
    const { data: inUseRows } = await supabaseAdmin
      .from("vehicle_requests")
      .select("employee_name")
      .eq("facility", facilityKey)
      .eq("vehicle", vehicle)
      .eq("status", "approved")
      .is("returned_at", null)
      .limit(1);

    if (inUseRows && inUseRows.length > 0) {
      return NextResponse.json(
        { error: `${inUseRows[0].employee_name} is currently using this vehicle/equipment.` },
        { status: 409 }
      );
    }
  }

  const approval_token = randomUUID();

  const { data: request, error } = await supabaseAdmin
    .from("vehicle_requests")
    .insert({
      employee_name,
      vehicle: is_external ? null : vehicle,
      destination,
      estimated_time: is_external ? null : estimated_time,
      is_external: !!is_external,
      customer_name: is_external ? customer_name : null,
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
  }

  return NextResponse.json({ request });
}
