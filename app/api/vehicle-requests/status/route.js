import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/vehicle-requests/status?token=xxx
// Public, read-only — safe fields only, no approve/reject capability even
// though it reuses the same token as the coordinator email links.
export async function GET(req) {
  const limited = checkRateLimit(req, "vehicle-request-status");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("vehicle_requests")
    .select("employee_name, vehicle, destination, estimated_time, needed_from, needed_until, is_external, customer_name, status, created_at")
    .eq("approval_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json(
    { request: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
