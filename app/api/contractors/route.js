import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { uploadPrivateFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

// POST /api/contractors { full_name, email, resident_id, passport (data URL), estimated_duration }
// Public, no login — creates a "pending" contractor record. An admin must
// activate it from /admin/contractors before the pass is usable.
export async function POST(req) {
  const limited = checkRateLimit(req, "contractors");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { full_name, email, resident_id, passport, estimated_duration } = await req.json();

  if (!full_name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = randomUUID();
  const pass_token = randomUUID();

  try {
    const passport_path = passport
      ? await uploadPrivateFile(supabaseAdmin, "contractor-documents", `${id}-passport`, passport)
      : null;

    const { data: contractor, error } = await supabaseAdmin
      .from("contractors")
      .insert({
        id,
        full_name,
        email,
        resident_id,
        passport_url: passport_path,
        estimated_duration,
        status: "pending",
        pass_token,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const origin = req.nextUrl.origin;
    return NextResponse.json({ contractor, passUrl: `${origin}/contractor-pass?token=${pass_token}` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
