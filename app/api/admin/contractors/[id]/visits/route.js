import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { randomUUID } from "crypto";

// GET /api/admin/contractors/[id]/visits
// Full visit history for one contractor, most recent first — powers the
// "View log" modal on the admin dashboard.
export async function GET(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("contractor_visits")
    .select("*")
    .eq("contractor_id", params.id)
    .order("checked_in_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visits: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// POST /api/admin/contractors/[id]/visits { action: "checkin" | "checkout" }
// Logs a single visit event. A contractor can hold a multi-entry pass, so
// this is a log table (one row per visit) rather than a status field —
// "checked in" just means the most recent row has no checked_out_at yet,
// same pattern as vehicle_movements.
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json();
  if (!["checkin", "checkout"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: contractor, error: contractorError } = await supabaseAdmin
    .from("contractors")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (contractorError || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  // The currently-open visit, if any (checked_out_at is null). Used to
  // block a duplicate check-in and to find the row a check-out should close.
  const { data: openVisit } = await supabaseAdmin
    .from("contractor_visits")
    .select("*")
    .eq("contractor_id", params.id)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (action === "checkin") {
    if (contractor.status !== "active") {
      return NextResponse.json(
        { error: "Only contractors with an active pass can be checked in" },
        { status: 400 }
      );
    }
    if (openVisit) {
      return NextResponse.json({ error: "This contractor is already checked in" }, { status: 409 });
    }

    const { data: visit, error } = await supabaseAdmin
      .from("contractor_visits")
      .insert({
        id: randomUUID(),
        contractor_id: params.id,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.email,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ visit, currently_checked_in: true });
  }

  // action === "checkout"
  if (!openVisit) {
    return NextResponse.json({ error: "This contractor isn't currently checked in" }, { status: 409 });
  }

  const { data: visit, error } = await supabaseAdmin
    .from("contractor_visits")
    .update({ checked_out_at: new Date().toISOString(), checked_out_by: user.email })
    .eq("id", openVisit.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visit, currently_checked_in: false });
}
