import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { WAREHOUSE_PHOTOS_BUCKET, MAX_PHOTOS, warehousePhotoPath } from "@/lib/warehousePhotos";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/warehouse-photos/upload-urls { count }
// -> { upload_id, uploads: [{ path, token }] }
//
// Open (no login) - part of the Staff Hub. Photos go straight from the
// browser to Supabase Storage with one-time signed upload URLs, because
// 5-20 photos would blow far past Vercel's 4.5MB request body limit if
// they were sent through an API route. Paths are generated here, so the
// browser can't choose where files land; POST /api/warehouse-photos then
// checks they all arrived before saving the submission.
export async function POST(req) {
  const limited = checkRateLimit(req, "warehouse-photos-upload-urls");
  if (limited) return limited;

  const { count } = await req.json().catch(() => ({}));
  if (!Number.isInteger(count) || count < 1) {
    return NextResponse.json({ error: "Add at least one photo" }, { status: 400 });
  }
  if (count > MAX_PHOTOS) {
    return NextResponse.json({ error: `You can add up to ${MAX_PHOTOS} photos per submission` }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const upload_id = randomUUID();

  try {
    const uploads = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const path = warehousePhotoPath(upload_id, i);
        const { data, error } = await supabaseAdmin.storage
          .from(WAREHOUSE_PHOTOS_BUCKET)
          .createSignedUploadUrl(path);
        if (error) throw new Error(error.message);
        return { path, token: data.token };
      })
    );
    return NextResponse.json({ upload_id, uploads });
  } catch (err) {
    return NextResponse.json({ error: `Could not prepare upload: ${err.message}` }, { status: 500 });
  }
}
