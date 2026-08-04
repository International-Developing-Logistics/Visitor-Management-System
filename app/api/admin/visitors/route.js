import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// GET /api/admin/visitors?status=checked_in — list visitors, newest first.
// Pass no status to get everyone; status can be a single value or omitted.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const status = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("visitors")
    .select("*, hosts(name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visitors: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
