import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// GET /api/admin/contractor-visits
// Every contractor visit ever logged, across every contractor, newest
// first — the flat history table behind the "Contractor Check In/Out"
// admin module (separate from the "Contractors" module, which only
// handles registration review and pass activation/deactivation).
// Embeds the contractor's name/company/pass ID so the page doesn't need
// a second round trip per row.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("contractor_visits")
    .select("*, contractor:contractors(full_name, company, pass_id, status)")
    .order("checked_in_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visits: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
