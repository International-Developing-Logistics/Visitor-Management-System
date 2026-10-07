import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/visitors/lookup?phone=... - public, used by the "Welcome back"
// prompt on the self-service check-in forms (see VisitorDetailsForm.jsx).
// Returns only what's needed to pre-fill a returning visitor's form and
// let them skip re-typing everything: name, company, visitor type, and
// host - deliberately NEVER email, and deliberately not any visit history
// (that stays admin-only via GET /api/admin/visitors?phone=).
//
// Tightly rate-limited (5/min/IP, well below every other public route's
// 20/min default) because unlike the other public endpoints here, this one
// answers a yes/no question about whether a phone number is on file at
// all - the kind of thing worth making slower to enumerate.
export async function GET(req) {
  const limited = checkRateLimit(req, "visitors-lookup", 5);
  if (limited) return limited;

  const phone = req.nextUrl.searchParams.get("phone");
  const digits = String(phone || "").replace(/\D/g, "");

  // Require a real, substantial phone number before even querying - stops
  // a near-empty value from matching a huge swath of rows via a sloppy
  // client-side bug, and stops this from being usable as a one-digit-at-a-
  // time probing tool.
  if (digits.length < 7) {
    return NextResponse.json({ found: false });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("visitors")
    .select("full_name, company, visitor_type, host_id, hosts(name)")
    .eq("phone_digits", digits)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    visitor: {
      full_name: data.full_name || "",
      company: data.company || "",
      visitor_type: data.visitor_type || "",
      host_id: data.host_id || "",
      host_name: data.hosts?.name || "",
    },
  });
}
