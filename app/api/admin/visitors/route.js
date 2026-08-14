import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/admin/visitors?status=checked_in&facility=idl — list visitors,
// newest first. Pass no status to get everyone in that facility; status can
// be a single value, a comma-separated list (e.g.
// "gate_pending,gate_approved,gate_denied"), or omitted. facility defaults
// to the original facility so results never silently mix facilities.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const status = req.nextUrl.searchParams.get("status");
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  let query = supabaseAdmin
    .from("visitors")
    .select("*, hosts(name, email)")
    .eq("facility", facility)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    query = statuses.length > 1 ? query.in("status", statuses) : query.eq("status", statuses[0]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visitors: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
