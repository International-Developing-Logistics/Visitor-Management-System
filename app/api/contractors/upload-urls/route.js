import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  CONTRACTOR_DOCS_BUCKET,
  MAX_DOCUMENT_BYTES,
  ACCEPTED_DOCUMENT_TYPES,
  SLOTS_BY_DOCUMENT_TYPE,
} from "@/lib/contractorDocuments";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/contractors/upload-urls
// { document_type: "freezone_pass" | "passport_emirates_id",
//   files: { [slot]: { type, size } } }
// -> { upload_id, uploads: { [slot]: { path, token } } }
//
// Contractor documents are uploaded straight from the browser to Supabase
// Storage using one-time signed upload URLs, instead of being sent through
// /api/contractors as base64 JSON. Vercel rejects function request bodies
// over 4.5MB ("Request Entity Too Large"), which a passport PDF + Emirates ID
// photo easily exceed once base64-encoded. Paths are generated here from a
// fresh server-side id, so the client can't choose where files land; the
// follow-up POST /api/contractors { upload_id } checks the files exist.
export async function POST(req) {
  const limited = checkRateLimit(req, "contractor-upload-urls");
  if (limited) return limited;

  const { document_type, files } = await req.json().catch(() => ({}));
  const slots = SLOTS_BY_DOCUMENT_TYPE[document_type];
  if (!slots) return NextResponse.json({ error: "Choose a document option" }, { status: 400 });

  for (const slot of slots) {
    const meta = files?.[slot];
    if (!meta) return NextResponse.json({ error: "Please upload all required documents" }, { status: 400 });
    if (!ACCEPTED_DOCUMENT_TYPES.includes(meta.type)) {
      return NextResponse.json({ error: "Please upload a JPG, PNG, or PDF file." }, { status: 400 });
    }
    if (!(meta.size > 0) || meta.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Each file must be under 10MB." }, { status: 400 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const upload_id = randomUUID();
  const uploads = {};

  try {
    for (const slot of slots) {
      const path = `${upload_id}-${slot}`;
      const { data, error } = await supabaseAdmin.storage
        .from(CONTRACTOR_DOCS_BUCKET)
        .createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      uploads[slot] = { path, token: data.token };
    }
  } catch (err) {
    return NextResponse.json({ error: `Could not prepare upload: ${err.message}` }, { status: 500 });
  }

  return NextResponse.json({ upload_id, uploads });
}
