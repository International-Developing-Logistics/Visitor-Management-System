import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

function htmlPage({ title, message, tone = "ok" }) {
  const color = tone === "ok" ? "#2a6f63" : tone === "warn" ? "#b3452f" : "#6b7268";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background:#faf9f6; color:#16211f;
         display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; }
  .card { background:white; border:1px solid #dfded7; border-radius:14px; padding:40px; max-width:420px; text-align:center; }
  h1 { font-size:1.3rem; color:${color}; margin-bottom:10px; }
  p { color:#6b7268; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

// GET /api/vehicle-requests/approve?token=xxx&action=approve|reject
// Opened directly from the email link — no login, the token IS the
// credential. Idempotent: re-clicking an already-decided link just shows
// the current state rather than erroring.
export async function GET(req) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");
  const action = req.nextUrl.searchParams.get("action");

  if (!token || !["approve", "reject"].includes(action)) {
    return new NextResponse(
      htmlPage({ title: "Invalid link", message: "This approval link is missing information.", tone: "warn" }),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const { data: request, error: findError } = await supabaseAdmin
    .from("vehicle_requests")
    .select("*")
    .eq("approval_token", token)
    .single();

  if (findError || !request) {
    return new NextResponse(
      htmlPage({ title: "Link not found", message: "This approval link is invalid or expired.", tone: "warn" }),
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  if (request.status !== "pending") {
    return new NextResponse(
      htmlPage({
        title: "Already decided",
        message: `${request.employee_name}'s request was already ${request.status}. No further action needed.`,
        tone: "neutral",
      }),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const { error: updateError } = await supabaseAdmin
    .from("vehicle_requests")
    .update({ status: newStatus, decided_at: new Date().toISOString() })
    .eq("id", request.id);

  if (updateError) {
    return new NextResponse(
      htmlPage({ title: "Something went wrong", message: updateError.message, tone: "warn" }),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  return new NextResponse(
    htmlPage({
      title: action === "approve" ? "Vehicle request approved" : "Vehicle request rejected",
      message:
        action === "approve"
          ? `${request.employee_name}'s request for ${request.vehicle} has been approved.`
          : `${request.employee_name}'s request has been rejected.`,
      tone: action === "approve" ? "ok" : "warn",
    }),
    { headers: { "Content-Type": "text/html" } }
  );
}
