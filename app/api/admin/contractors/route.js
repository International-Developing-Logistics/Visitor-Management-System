import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";

// GET /api/admin/contractors — list every contractor, newest first, with
// short-lived signed URLs for whichever documents they submitted (never a
// permanent public one). A contractor submits ONE of two document sets —
// a Freezone gate pass, or a passport + Emirates ID pair — so most rows
// will only have one or two of the three possible URLs signed.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("contractors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allPaths = data.flatMap((c) => [c.passport_url, c.freezone_pass_url, c.emirates_id_url]);
  const signedMap = await signMany(supabaseAdmin, "contractor-documents", allPaths, 600);

  // Which of these contractors currently has an open visit (checked in,
  // not yet checked out) — one query for the whole list rather than one
  // per row. See app/api/admin/contractors/[id]/visits/route.js.
  let checkedInIds = new Set();
  if (data.length > 0) {
    const { data: openVisits } = await supabaseAdmin
      .from("contractor_visits")
      .select("contractor_id")
      .in("contractor_id", data.map((c) => c.id))
      .is("checked_out_at", null);
    checkedInIds = new Set((openVisits || []).map((v) => v.contractor_id));
  }

  const contractors = data.map((c) => ({
    ...c,
    passport_signed_url: c.passport_url ? signedMap.get(c.passport_url) || null : null,
    freezone_pass_signed_url: c.freezone_pass_url ? signedMap.get(c.freezone_pass_url) || null : null,
    emirates_id_signed_url: c.emirates_id_url ? signedMap.get(c.emirates_id_url) || null : null,
    currently_checked_in: checkedInIds.has(c.id),
  }));

  return NextResponse.json(
    { contractors },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
