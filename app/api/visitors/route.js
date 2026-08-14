import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { DEFAULT_FACILITY } from "@/lib/facilities";
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
    purpose,
    host_id,
    notes,
    agreed, // boolean — replaces the old signature capture
    visit_type, // "walkin" | "prereg"
    additional_visitor_count,
    additional_visitor_names,
    facility,
  } = body;

  // Email is intentionally NOT required here — visitors can check in without one.
  if (!full_name || !purpose || !host_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!agreed) {
    return NextResponse.json({ error: "You must agree to the terms to check in" }, { status: 400 });
  }

  const id = randomUUID();
  const status = visit_type === "prereg" ? "pre_registered" : "checked_in";
  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;

  try {
    const row = {
      id,
      full_name,
      email: email || null,
      phone,
      company,
      purpose,
      host_id,
      notes,
      nda_signed_at: new Date().toISOString(),
      visit_type: visit_type === "prereg" ? "prereg" : "walkin",
      status,
      checkin_token: visit_type === "prereg" ? randomUUID() : null,
      checked_in_at: status === "checked_in" ? new Date().toISOString() : null,
      additional_visitor_count: groupCount,
      additional_visitor_names: additional_visitor_names || null,
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
