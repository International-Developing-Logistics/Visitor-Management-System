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

// GET /api/gate/approve?token=xxx&action=approve|deny
// Opened directly from the email link — no login, the token IS the
// credential. Idempotent: re-clicking an already-decided link just shows
// the current state rather than erroring.
export async function GET(req) {
  const supabaseAdmin = getSupabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");
  const action = req.nextUrl.searchParams.get("action");

  if (!token || !["approve", "deny"].includes(action)) {
    return new NextResponse(
      htmlPage({ title: "Invalid link", message: "This approval link is missing information.", tone: "warn" }),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const { data: visitor, error: findError } = await supabaseAdmin
    .from("visitors")
    .select("*")
    .eq("approval_token", token)
    .single();

  if (findError || !visitor) {
    return new NextResponse(
      htmlPage({ title: "Link not found", message: "This approval link is invalid or expired.", tone: "warn" }),
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  if (visitor.status !== "gate_pending") {
    const already = visitor.status === "gate_approved" ? "approved" : "denied";
    return new NextResponse(
      htmlPage({
        title: "Already decided",
        message: `${visitor.full_name} was already ${already}. No further action needed.`,
        tone: "neutral",
      }),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const newStatus = action === "approve" ? "gate_approved" : "gate_denied";
  const { error: updateError } = await supabaseAdmin
    .from("visitors")
    .update({ status: newStatus })
    .eq("id", visitor.id);

  if (updateError) {
    return new NextResponse(
      htmlPage({ title: "Something went wrong", message: updateError.message, tone: "warn" }),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  return new NextResponse(
    htmlPage({
      title: action === "approve" ? "Visitor approved" : "Visitor denied",
      message:
        action === "approve"
          ? `${visitor.full_name} can now proceed to reception to check in.`
          : `${visitor.full_name} has been denied entry.`,
      tone: action === "approve" ? "ok" : "warn",
    }),
    { headers: { "Content-Type": "text/html" } }
  );
}
