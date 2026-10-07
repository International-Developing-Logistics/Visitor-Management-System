import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { isValidVisitorType, sanitizeGroupMembers } from "@/lib/visitorTypes";
import { randomUUID } from "crypto";

// POST /api/preregister-open
// Public, no login, no invite needed - a guest fully self-registers for a
// future visit in one step. Same trust model as /walkin (which is also
// fully open): the host is notified immediately by email either way, so
// anything suspicious is visible to a real person right away. `facility`
// defaults to "harmony" when omitted, preserving the original page's behavior.
export async function POST(req) {
  const limited = checkRateLimit(req, "preregister-open");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.json();

  const {
    full_name,
    email, // optional - same as elsewhere in the app
    phone,
    company,
    visitor_type, // visitor-facing category - see lib/visitorTypes.js
    host_id,
    notes,
    agreed,
    additional_visitor_count,
    additional_visitor_names,
    group_members,
    proposed_alternative_time,
    facility,
  } = body;

  // `purpose` is deliberately NOT required (or accepted) here anymore -
  // it's assigned later by an admin from the Visitors dashboard.
  if (!full_name || !phone || !host_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!isValidVisitorType(visitor_type)) {
    return NextResponse.json({ error: "Please select a visitor type" }, { status: 400 });
  }
  if (!agreed) {
    return NextResponse.json({ error: "You must agree to the terms to continue" }, { status: 400 });
  }

  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;
  const cleanGroupMembers = sanitizeGroupMembers(group_members);

  try {
    const id = randomUUID();
    const checkin_token = randomUUID();

    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .insert({
        id,
        full_name,
        email: email || null,
        phone,
        company,
        visitor_type,
        host_id,
        notes,
        nda_signed_at: new Date().toISOString(),
        visit_type: "prereg",
        status: "pre_registered",
        checkin_token,
        additional_visitor_count: cleanGroupMembers.length > 0 ? cleanGroupMembers.length : groupCount,
        additional_visitor_names: additional_visitor_names || null,
        group_members: cleanGroupMembers.length > 0 ? cleanGroupMembers : null,
        proposed_alternative_time: proposed_alternative_time
          ? new Date(proposed_alternative_time).toISOString()
          : null,
        facility: facility || DEFAULT_FACILITY,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", host_id).single();
    if (host) {
      await sendHostNotification({ host, visitor, status: "pre_registered" });
    }

    const origin = req.nextUrl.origin;
    return NextResponse.json({ visitor, checkinUrl: `${origin}/checkin?token=${checkin_token}` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
