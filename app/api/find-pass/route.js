import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendContractorPassLinkEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

// POST /api/find-pass { email }
// Same pattern as /api/find-registration: never confirms or denies a match
// in the response, only ever re-sends the link by email — so someone can't
// harvest another contractor's pass link just by knowing their email.
export async function POST(req) {
  const limited = checkRateLimit(req, "find-pass");
  if (limited) return limited;

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Please enter an email address" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: matches } = await supabaseAdmin
      .from("contractors")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(3);

    if (matches && matches.length > 0) {
      const origin = req.nextUrl.origin;
      for (const contractor of matches) {
        const passUrl = `${origin}/contractor-pass?token=${contractor.pass_token}`;
        await sendContractorPassLinkEmail({ contractor, passUrl }).catch((err) =>
          console.error("[find-pass] resend failed:", err.message)
        );
      }
    }
  } catch (err) {
    console.error("[find-pass] lookup failed:", err.message);
  }

  return NextResponse.json({
    message: "If we found a matching pass, we've emailed you the link.",
  });
}
