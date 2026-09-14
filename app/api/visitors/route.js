import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { isValidVisitorType, sanitizeGroupMembers } from "@/lib/visitorTypes";
import { randomUUID } from "crypto";

export async function POST(req) {
  const limited = checkRateLimit(req, "visitors");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.json();

  const {
    full_name,
    email, // optional — may be empty/null
    phone,
    company,
    visitor_type, // the visitor-facing category — see lib/visitorTypes.js. NOT the same as visit_type below.
    host_id,
    notes,
    agreed, // boolean — replaces the old signature capture
    visit_type, // "walkin" | "prereg" — which channel this came through
    additional_visitor_count,
    additional_visitor_names,
    group_members,
    facility,
  } = body;

  // Email is intentionally NOT required here — visitors can check in without one.
  // `purpose` is deliberately NOT required (or even accepted) here anymore —
  // it's assigned later by an admin from the Visitors dashboard.
  if (!full_name || !phone || !host_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!isValidVisitorType(visitor_type)) {
    return NextResponse.json({ error: "Please select a visitor type" }, { status: 400 });
  }
  if (!agreed) {
    return NextResponse.json({ error: "You must agree to the terms to check in" }, { status: 400 });
  }

  const id = randomUUID();
  const status = visit_type === "prereg" ? "pre_registered" : "checked_in";
  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;
  const cleanGroupMembers = sanitizeGroupMembers(group_members);

  try {
    const row = {
      id,
      full_name,
      email: email || null,
      phone,
      company,
      visitor_type,
      host_id,
      notes,
      nda_signed_at: new Date().toISOString(),
      visit_type: visit_type === "prereg" ? "prereg" : "walkin",
      status,
      checkin_token: visit_type === "prereg" ? randomUUID() : null,
      checked_in_at: status === "checked_in" ? new Date().toISOString() : null,
      additional_visitor_count: cleanGroupMembers.length > 0 ? cleanGroupMembers.length : groupCount,
      additional_visitor_names: additional_visitor_names || null,
      group_members: cleanGroupMembers.length > 0 ? cleanGroupMembers : null,
      facility: facility || DEFAULT_FACILITY,
    };

    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: host } = await supabaseAdmin
      .from("hosts")
      .select("*")
      .eq("id", host_id)
      .single();

    if (host) {
      await sendHostNotification({ host, visitor, status });
    }

    return NextResponse.json({ visitor });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
