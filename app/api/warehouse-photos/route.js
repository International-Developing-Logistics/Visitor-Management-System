import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { getFacility } from "@/lib/facilities";
import {
  WAREHOUSE_PHOTOS_BUCKET,
  MAX_PHOTOS,
  warehousePhotoPath,
  DEFAULT_WAREHOUSE_PHOTOS_EMAIL,
  MAX_EMAIL_ZIP_BYTES,
  warehouseZipName,
  warehouseZipEntryName,
} from "@/lib/warehousePhotos";
import { buildZip } from "@/lib/zip";
import { sendWarehousePhotosEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
// Zipping + emailing up to 30 photos takes a few seconds; give it room.
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/warehouse-photos
// { facility, staff_name, client_name, grn, container_count, upload_id, count }
//
// Open (no login) - Staff Hub. Saves a warehouse photo submission after the
// photos were uploaded directly to storage via /api/warehouse-photos/upload-urls.
export async function POST(req) {
  const limited = checkRateLimit(req, "warehouse-photos");
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const staff_name = String(body.staff_name || "").trim();
  const client_name = String(body.client_name || "").trim();
  const grn = String(body.grn || "").trim();
  const container_count = Number(body.container_count);
  const { upload_id, count } = body;

  if (!staff_name) return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  if (!client_name) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  if (!grn) return NextResponse.json({ error: "GRN is required" }, { status: 400 });
  if (!Number.isInteger(container_count) || container_count < 0 || container_count > 1000) {
    return NextResponse.json({ error: "Enter a valid number of containers" }, { status: 400 });
  }
  if (typeof upload_id !== "string" || !UUID_RE.test(upload_id)) {
    return NextResponse.json({ error: "Photos are missing - please try again" }, { status: 400 });
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_PHOTOS) {
    return NextResponse.json({ error: "Add at least one photo" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Make sure every photo actually landed in storage before saving.
  const expected = Array.from({ length: count }, (_, i) => warehousePhotoPath(upload_id, i));
  const { data: found, error: listError } = await supabaseAdmin.storage
    .from(WAREHOUSE_PHOTOS_BUCKET)
    .list(upload_id, { limit: 100 });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  const names = new Set((found || []).map((f) => `${upload_id}/${f.name}`));
  const missing = expected.filter((p) => !names.has(p));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.length} photo(s) didn't finish uploading - please try again.` },
      { status: 400 }
    );
  }

  const facility = getFacility(body.facility);
  const { data: submission, error } = await supabaseAdmin
    .from("warehouse_photo_submissions")
    .insert({
      id: upload_id,
      facility: facility.key,
      staff_name,
      client_name,
      grn,
      container_count,
      photo_paths: expected,
    })
    .select()
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "This submission was already saved." : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }

  // The submission is saved at this point - an email problem must never
  // make staff think their photos were lost, so it's reported, not thrown.
  const emailed = await emailSubmission({ supabaseAdmin, submission, facility, origin: req.nextUrl.origin });
  return NextResponse.json({ ok: true, id: upload_id, emailed });
}

// Emails the submission with all photos zipped. Returns true if sent.
async function emailSubmission({ supabaseAdmin, submission, facility, origin }) {
  const to = (process.env.WAREHOUSE_PHOTOS_EMAIL || DEFAULT_WAREHOUSE_PHOTOS_EMAIL)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const photos = await Promise.all(
      submission.photo_paths.map(async (path) => {
        const { data, error } = await supabaseAdmin.storage.from(WAREHOUSE_PHOTOS_BUCKET).download(path);
        if (error) throw new Error(`download ${path}: ${error.message}`);
        return new Uint8Array(await data.arrayBuffer());
      })
    );
    const zipBytes = buildZip(
      photos.map((data, i) => ({ name: warehouseZipEntryName(submission, i), data })),
      new Date(submission.created_at)
    );
    const attach = zipBytes.length <= MAX_EMAIL_ZIP_BYTES;

    const result = await sendWarehousePhotosEmail({
      to,
      submission,
      facilityLabel: facility.label,
      photoCount: photos.length,
      zip: attach ? Buffer.from(zipBytes) : null,
      zipFileName: warehouseZipName(submission),
      adminUrl: `${origin}/admin/warehouse-photos`,
    });
    if (result?.error) throw new Error(result.error.message || JSON.stringify(result.error));
    return !result?.skipped;
  } catch (err) {
    console.error("[warehouse-photos] email failed for", submission.id, "-", err.message);
    return false;
  }
}
