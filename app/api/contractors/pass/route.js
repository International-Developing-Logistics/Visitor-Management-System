import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/contractors/pass?token=xxx
// Public — deliberately returns only what's safe to show on a pass someone
// might display at a gate: name, company, pass ID, status, validity
// window. Never the passport/Emirates ID/Freezone pass images, resident
// ID, or email.
export async function GET(req) {
  const limited = checkRateLimit(req, "contractors-pass");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("contractors")
    .select("full_name, company, pass_id, status, validity_start, validity_end")
    .eq("pass_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  return NextResponse.json(
    { pass: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
