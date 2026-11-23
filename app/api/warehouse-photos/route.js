import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { getFacility } from "@/lib/facilities";
import { WAREHOUSE_PHOTOS_BUCKET, MAX_PHOTOS, warehousePhotoPath } from "@/lib/warehousePhotos";

export const dynamic = "force-dynamic";

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

  const { error } = await supabaseAdmin.from("warehouse_photo_submissions").insert({
    id: upload_id,
    facility: getFacility(body.facility).key,
    staff_name,
    client_name,
    grn,
    container_count,
    photo_paths: expected,
  });

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "This submission was already saved." : error.message },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true, id: upload_id });
}
