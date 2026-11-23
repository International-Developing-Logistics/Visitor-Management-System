import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { uploadPrivateFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendContractorRegistrationSubmittedEmail } from "@/lib/email";
import { CONTRACTOR_DOCS_BUCKET, SLOTS_BY_DOCUMENT_TYPE } from "@/lib/contractorDocuments";
import { randomUUID } from "crypto";

const DOCUMENT_TYPES = ["freezone_pass", "passport_emirates_id"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/contractors
// { full_name, email, resident_id, company, estimated_duration,
//   document_type: "freezone_pass" | "passport_emirates_id",
//   freezone_pass (data URL, required for freezone_pass),
//   passport (data URL, required for passport_emirates_id),
//   emirates_id (data URL, required for passport_emirates_id),
//   upload_id (preferred instead of the data URLs: id from
//     /api/contractors/upload-urls after uploading the files directly) }
//
// Public, no login - creates a "pending" contractor record. An admin must
// approve it from /admin/contractors before the pass is usable. Applicants
// choose ONE of two document options; which files are required depends on
// that choice, so the check below is the real gate - the registration page
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
    upload_id,
  } = await req.json();

  if (!full_name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json({ error: "Choose a document option" }, { status: 400 });
  }

  // Preferred flow: files were already uploaded directly to storage via
  // /api/contractors/upload-urls (keeps this request tiny - Vercel caps
  // function request bodies at 4.5MB). Legacy flow: base64 data URLs in
  // the body, kept for any page still open from before this change.
  const usingDirectUpload = typeof upload_id === "string" && UUID_RE.test(upload_id);

  if (!usingDirectUpload) {
    if (document_type === "freezone_pass" && !freezone_pass) {
      return NextResponse.json({ error: "Please upload your Freezone gate pass" }, { status: 400 });
    }
    if (document_type === "passport_emirates_id" && (!passport || !emirates_id)) {
      return NextResponse.json({ error: "Please upload both your passport and Emirates ID" }, { status: 400 });
    }
  }

  const id = usingDirectUpload ? upload_id : randomUUID();
  const pass_token = randomUUID();

  try {
    let freezone_pass_path = null;
    let passport_path = null;
    let emirates_id_path = null;

    if (usingDirectUpload) {
      const slots = SLOTS_BY_DOCUMENT_TYPE[document_type];
      const { data: found, error: listError } = await supabaseAdmin.storage
        .from(CONTRACTOR_DOCS_BUCKET)
        .list("", { search: id, limit: 10 });
      if (listError) throw new Error(listError.message);
      const names = new Set((found || []).map((f) => f.name));
      const missing = slots.filter((slot) => !names.has(`${id}-${slot}`));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Your documents didn't finish uploading - please try again." },
          { status: 400 }
        );
      }
      if (document_type === "freezone_pass") {
        freezone_pass_path = `${id}-freezone-pass`;
      } else {
        passport_path = `${id}-passport`;
        emirates_id_path = `${id}-emirates-id`;
      }
    } else {
      [freezone_pass_path, passport_path, emirates_id_path] = await Promise.all([
        document_type === "freezone_pass" && freezone_pass
          ? uploadPrivateFile(supabaseAdmin, CONTRACTOR_DOCS_BUCKET, `${id}-freezone-pass`, freezone_pass)
          : null,
        document_type === "passport_emirates_id" && passport
          ? uploadPrivateFile(supabaseAdmin, CONTRACTOR_DOCS_BUCKET, `${id}-passport`, passport)
          : null,
        document_type === "passport_emirates_id" && emirates_id
          ? uploadPrivateFile(supabaseAdmin, CONTRACTOR_DOCS_BUCKET, `${id}-emirates-id`, emirates_id)
          : null,
      ]);
    }

    const { data: passIdData, error: passIdError } = await supabaseAdmin.rpc("next_contractor_pass_id");
    if (passIdError) throw new Error(passIdError.message);

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
