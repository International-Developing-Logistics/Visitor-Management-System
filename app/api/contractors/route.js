import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { uploadPrivateFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendContractorRegistrationSubmittedEmail } from "@/lib/email";
import { randomUUID } from "crypto";

const DOCUMENT_TYPES = ["freezone_pass", "passport_emirates_id"];

// POST /api/contractors
// { full_name, email, resident_id, company, estimated_duration,
//   document_type: "freezone_pass" | "passport_emirates_id",
//   freezone_pass (data URL, required for freezone_pass),
//   passport (data URL, required for passport_emirates_id),
//   emirates_id (data URL, required for passport_emirates_id) }
//
// Public, no login — creates a "pending" contractor record. An admin must
// approve it from /admin/contractors before the pass is usable. Applicants
// choose ONE of two document options; which files are required depends on
// that choice, so the check below is the real gate — the registration page
// only disables its submit button as a convenience, never the source of
// truth (client-side validation is never trusted alone here).
export async function POST(req) {
  const limited = checkRateLimit(req, "contractors");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const {
    full_name,
    email,
    resident_id,
    company,
    estimated_duration,
    document_type,
    freezone_pass,
    passport,
    emirates_id,
  } = await req.json();

  if (!full_name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json({ error: "Choose a document option" }, { status: 400 });
  }
  if (document_type === "freezone_pass" && !freezone_pass) {
    return NextResponse.json({ error: "Please upload your Freezone gate pass" }, { status: 400 });
  }
  if (document_type === "passport_emirates_id" && (!passport || !emirates_id)) {
    return NextResponse.json({ error: "Please upload both your passport and Emirates ID" }, { status: 400 });
  }

  const id = randomUUID();
  const pass_token = randomUUID();

  try {
    const { data: passIdData, error: passIdError } = await supabaseAdmin.rpc("next_contractor_pass_id");
    if (passIdError) throw new Error(passIdError.message);

    const [freezone_pass_path, passport_path, emirates_id_path] = await Promise.all([
      document_type === "freezone_pass" && freezone_pass
        ? uploadPrivateFile(supabaseAdmin, "contractor-documents", `${id}-freezone-pass`, freezone_pass)
        : null,
      document_type === "passport_emirates_id" && passport
        ? uploadPrivateFile(supabaseAdmin, "contractor-documents", `${id}-passport`, passport)
        : null,
      document_type === "passport_emirates_id" && emirates_id
        ? uploadPrivateFile(supabaseAdmin, "contractor-documents", `${id}-emirates-id`, emirates_id)
        : null,
    ]);

    const { data: contractor, error } = await supabaseAdmin
      .from("contractors")
      .insert({
        id,
        full_name,
        email,
        resident_id,
        company,
        estimated_duration,
        document_type,
        freezone_pass_url: freezone_pass_path,
        passport_url: passport_path,
        emirates_id_url: emirates_id_path,
        status: "pending",
        pass_id: passIdData,
        pass_token,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const origin = req.nextUrl.origin;
    sendContractorRegistrationSubmittedEmail({
      contractor,
      reviewUrl: `${origin}/admin/contractors`,
    }).catch((err) => console.error("[contractors] submission notification failed:", err.message));

    return NextResponse.json({ contractor, passUrl: `${origin}/contractor-pass?token=${pass_token}` });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
