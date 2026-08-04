import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendVisitorInviteEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/verifyAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

// POST /api/preregister { email, full_name?, host_id, purpose, notes?, send_email?,
//   additional_visitor_count?, additional_visitor_names? }
// Creates a stub visitor row and returns a check-in link staff can share
// however they like. Only sends the link by email if send_email is true.
// Staff-only.
export async function POST(req) {
  const limited = checkRateLimit(req, "preregister-invite");
  if (limited) return limited;

  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const {
    email,
    full_name,
    host_id,
    purpose,
    notes,
    send_email,
    additional_visitor_count,
    additional_visitor_names,
  } = await req.json();

  if (!email || !host_id || !purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = randomUUID();
  const checkin_token = randomUUID();
  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .insert({
      id,
      email,
      full_name: full_name || "",
      host_id,
      purpose,
      notes,
      visit_type: "prereg",
      status: "invited",
      checkin_token,
      additional_visitor_count: groupCount,
      additional_visitor_names: additional_visitor_names || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", host_id).single();

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
