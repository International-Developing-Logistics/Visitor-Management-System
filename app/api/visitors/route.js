import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { uploadPrivateFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
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
    signature, // data URL
    visit_type, // "walkin" | "prereg"
    additional_visitor_count,
    additional_visitor_names,
  } = body;

  // Email is intentionally NOT required here — visitors can check in without one.
  if (!full_name || !purpose || !host_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = randomUUID();
  const status = visit_type === "prereg" ? "pre_registered" : "checked_in";
  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;

  try {
    // No photo capture in the check-in flow anymore — signature (NDA) only.
    const signature_path = signature
      ? await uploadPrivateFile(supabaseAdmin, "visitor-signatures", `${id}.png`, signature)
      : null;

    const row = {
      id,
      full_name,
      email: email || null,
      phone,
      company,
      purpose,
      host_id,
      notes,
      signature_url: signature_path,
      nda_signed_at: signature ? new Date().toISOString() : null,
      visit_type: visit_type === "prereg" ? "prereg" : "walkin",
      status,
      checkin_token: visit_type === "prereg" ? randomUUID() : null,
      checked_in_at: status === "checked_in" ? new Date().toISOString() : null,
      additional_visitor_count: groupCount,
      additional_visitor_names: additional_visitor_names || null,
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
