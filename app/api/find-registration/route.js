import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendVisitorInviteEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

// POST /api/find-registration { email }
// Re-sends the check-in link to a guest who's lost it, by email lookup.
// Deliberately never confirms or denies whether a match was found in the
// response — always returns the same generic message, and only ever
// re-sends the link via email (never displays it in the browser). This
// means someone can't harvest another person's check-in link just by
// knowing their email address; they'd need actual access to that inbox.
export async function POST(req) {
  const limited = checkRateLimit(req, "find-registration");
  if (limited) return limited;

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Please enter an email address" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: matches } = await supabaseAdmin
      .from("visitors")
      .select("*, hosts(name, email)")
      .eq("email", email)
      .eq("visit_type", "prereg")
      .in("status", ["invited", "pre_registered"])
      .not("checkin_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);

    if (matches && matches.length > 0) {
      const origin = req.nextUrl.origin;
      for (const visitor of matches) {
        if (!visitor.hosts) continue;
        const checkinUrl = `${origin}/checkin?token=${visitor.checkin_token}`;
        await sendVisitorInviteEmail({ visitor, host: visitor.hosts, checkinUrl }).catch((err) =>
          console.error("[find-registration] resend failed:", err.message)
        );
      }
    }
  } catch (err) {
    console.error("[find-registration] lookup failed:", err.message);
  }

  return NextResponse.json({
    message: "If we found a matching pre-registration, we've emailed you the link.",
  });
}
