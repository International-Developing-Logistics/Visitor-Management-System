import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { signMany } from "@/lib/storage";
import { WAREHOUSE_PHOTOS_BUCKET } from "@/lib/warehousePhotos";

export const dynamic = "force-dynamic";

// GET /api/admin/warehouse-photos?facility=harmony&q=GRN-or-client
// Latest 50 submissions, each with signed photo URLs (valid 1 hour).
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  let query = supabaseAdmin.from("warehouse_photo_submissions").select("*");
  if (facility !== "all") query = query.eq("facility", facility);
  if (q) {
    // Strip characters that have meaning in PostgREST filter syntax.
    const safe = q.replace(/[%_,()*\\]/g, " ").trim();
    if (safe) query = query.or(`grn.ilike.%${safe}%,client_name.ilike.%${safe}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signed = await signMany(
    supabaseAdmin,
    WAREHOUSE_PHOTOS_BUCKET,
    data.flatMap((s) => s.photo_paths || []),
    3600
  );

  const submissions = data.map((s) => ({
    ...s,
    photos: (s.photo_paths || []).map((p) => signed.get(p)).filter(Boolean),
  }));

  return NextResponse.json({ submissions }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
