import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { signOne } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/checkin?token=xxx — look up a pre-registered visitor
export async function GET(req) {
  const limited = checkRateLimit(req, "checkin-lookup");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .select("*, hosts(name)")
    .eq("checkin_token", token)
    .single();

  if (error || !visitor) {
    return NextResponse.json({ error: "We couldn't find that check-in link." }, { status: 404 });
  }
  return NextResponse.json({ visitor });
}

// POST /api/checkin { token } — confirm arrival, notify host
export async function POST(req) {
  const limited = checkRateLimit(req, "checkin-confirm");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("checkin_token", token)
    .select()
    .single();

  if (error || !visitor) {
    return NextResponse.json({ error: "Check-in failed. Please ask reception for help." }, { status: 404 });
  }

  const { data: host } = await supabaseAdmin
    .from("hosts")
    .select("*")
    .eq("id", visitor.host_id)
    .single();

  if (host) {
    const photoSignedUrl = visitor.photo_url
      ? await signOne(supabaseAdmin, "visitor-photos", visitor.photo_url, 60 * 60 * 24 * 7)
      : null;
    await sendHostNotification({ host, visitor, status: "checked_in", photoSignedUrl });
  }

  return NextResponse.json({ visitor });
}
