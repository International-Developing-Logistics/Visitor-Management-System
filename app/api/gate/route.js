import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendGateApprovalRequest } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getGateApprovalRecipients, getFacility, DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

// POST /api/gate { full_name, purpose, facility? }
// Minimal gate walk-in form — creates a pending record and emails whoever's
// configured for that facility an Approve/Deny link. No host assigned yet —
// that happens at reception once approved. `facility` defaults to the
// original facility ("harmony") when omitted, so the existing /gate page's
// behavior is unchanged.
export async function POST(req) {
  const limited = checkRateLimit(req, "gate");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { full_name, purpose, facility } = await req.json();

  if (!full_name || !purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const facilityKey = facility || DEFAULT_FACILITY;
  const id = randomUUID();
  const approval_token = randomUUID();

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .insert({
      id,
      full_name,
      purpose,
      visit_type: "walkin",
      status: "gate_pending",
      approval_token,
      facility: facilityKey,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = req.nextUrl.origin;
  const approveUrl = `${origin}/api/gate/approve?token=${approval_token}&action=approve`;
  const denyUrl = `${origin}/api/gate/approve?token=${approval_token}&action=deny`;

  try {
    const recipients = getGateApprovalRecipients(facilityKey);
    const facilityLabel = facilityKey !== DEFAULT_FACILITY ? getFacility(facilityKey).label : undefined;
    await sendGateApprovalRequest({ visitor, approveUrl, denyUrl, recipients, facilityLabel });
  } catch (err) {
    console.error("[gate] approval email failed:", err.message);
    // Don't fail the visitor's submission just because the email had trouble —
    // admin can still see and approve it from the dashboard.
  }

  return NextResponse.json({ visitor });
}
