import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";

// GET /api/admin/contractors — list every contractor, newest first, with a
// short-lived signed URL for their passport (never a permanent public one).
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("contractors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoMap = await signMany(
    supabaseAdmin,
    "contractor-documents",
    data.map((c) => c.passport_url),
    600
  );

  const contractors = data.map((c) => ({
    ...c,
    passport_signed_url: c.passport_url ? photoMap.get(c.passport_url) || null : null,
  }));

  return NextResponse.json(
    { contractors },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
