import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  const limited = checkRateLimit(req, "preregister-complete");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const {
    token,
    full_name,
    phone,
    company,
    agreed, // boolean — replaces the old signature capture
    additional_visitor_count,
    additional_visitor_names,
    selected_time_slot,
  } = await req.json();

  if (!token || !full_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!agreed) {
    return NextResponse.json({ error: "You must agree to the terms to continue" }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from("visitors")
    .select("id")
    .eq("checkin_token", token)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;

  try {
    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .update({
        full_name,
        phone,
        company,
        nda_signed_at: new Date().toISOString(),
        status: "pre_registered",
        additional_visitor_count: groupCount,
        additional_visitor_names: additional_visitor_names || null,
        selected_time_slot: selected_time_slot ? new Date(selected_time_slot).toISOString() : null,
      })
      .eq("checkin_token", token)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", visitor.host_id).single();
    if (host) {
      await sendHostNotification({ host, visitor, status: "pre_registered" });
    }

    return NextResponse.json({ visitor });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
