import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireAnyRole } from "@/lib/verifyAdmin";
import { randomUUID } from "crypto";

// POST /api/recommendations { description: string }
// Open to any signed-in account — admin, staff, or guard. Deliberately
// anonymous: requireAnyRole confirms the caller is a real employee
// account (keeps this off the public internet), but the account's
// identity is never written to the feature_recommendations row below.
export async function POST(req) {
  const user = await requireAnyRole(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkRateLimit(req, "recommendations");
  if (limited) return limited;

  const { description } = await req.json();
  if (!description || !description.trim()) {
    return NextResponse.json({ error: "Enter a description first" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("feature_recommendations").insert({
    id: randomUUID(),
    description: description.trim(),
    status: "new",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
