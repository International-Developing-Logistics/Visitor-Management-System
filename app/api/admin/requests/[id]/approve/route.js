import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { sendVisitorInviteEmail } from "@/lib/email";
import { randomUUID } from "crypto";

// POST /api/admin/requests/[id]/approve { send_email? }
// Turns a host's "requested" row into a real "invited" one with a working
// check-in link. Optionally emails the guest directly.
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { send_email } = await req.json().catch(() => ({}));
  const supabaseAdmin = getSupabaseAdmin();

  const checkin_token = randomUUID();
  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .update({ status: "invited", checkin_token })
    .eq("id", params.id)
    .eq("status", "requested")
    .select()
    .single();

  if (error || !visitor) {
    return NextResponse.json({ error: "Request not found or already handled" }, { status: 404 });
  }

  const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", visitor.host_id).single();
  const origin = req.nextUrl.origin;
  const checkinUrl = `${origin}/checkin?token=${checkin_token}`;

  let emailSent = false;
  let emailError = null;
  if (send_email && host) {
    try {
      await sendVisitorInviteEmail({ visitor, host, checkinUrl });
      emailSent = true;
    } catch (err) {
      emailError = err.message;
    }
  }

  return NextResponse.json({ visitor, checkinUrl, emailSent, emailError });
}
