import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";

const BUCKET = "gate-check-forms";

// GET /api/admin/gate-check-forms/[id]
// Single record with signed URLs for every signature, the stamp, and any
// attached photos - for the admin detail/print view.
export async function GET(req, { params }) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: row, error } = await supabaseAdmin
    .from("gate_check_forms")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Gate check form not found" }, { status: 404 });

  const paths = [];
  Object.values(row.signatures || {}).forEach((s) => s?.photo_path && paths.push(s.photo_path));
  if (row.stamp_photo_path) paths.push(row.stamp_photo_path);
  (row.photos || []).forEach((p) => p.photo_path && paths.push(p.photo_path));

  const signedMap = await signMany(supabaseAdmin, BUCKET, paths, 600);

  const signatures = {};
  for (const [role, s] of Object.entries(row.signatures || {})) {
    signatures[role] = { ...s, signed_url: s?.photo_path ? signedMap.get(s.photo_path) || null : null };
  }
  const photos = (row.photos || []).map((p) => ({
    ...p,
    signed_url: p.photo_path ? signedMap.get(p.photo_path) || null : null,
  }));

  return NextResponse.json({
    form: {
      ...row,
      signatures,
      photos,
      stamp_signed_url: row.stamp_photo_path ? signedMap.get(row.stamp_photo_path) || null : null,
    },
  });
}
