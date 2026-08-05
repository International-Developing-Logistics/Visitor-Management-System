import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const EDITABLE_FIELDS = [
  "full_name",
  "email",
  "phone",
  "company",
  "purpose",
  "host_id",
  "notes",
  "additional_visitor_count",
  "additional_visitor_names",
];

// PATCH /api/admin/visitors/[id] — edit visitor details. Never deletes
// anything; only updates the fields explicitly sent.
//
// checked_out_at is handled separately from EDITABLE_FIELDS: it's how staff
// fix a premature/accidental check-out. Send an ISO timestamp to set a
// specific checkout time (status is forced to "checked_out"), or an empty
// string/null to undo a checkout entirely (status reverts to "checked_in").
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if ("checked_out_at" in body) {
    if (body.checked_out_at) {
      const d = new Date(body.checked_out_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "That checkout time doesn't look valid" }, { status: 400 });
      }
      updates.checked_out_at = d.toISOString();
      updates.status = "checked_out";
    } else {
      updates.checked_out_at = null;
      updates.status = "checked_in";
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  if ("full_name" in updates && !String(updates.full_name || "").trim()) {
    return NextResponse.json({ error: "Full name can't be empty" }, { status: 400 });
  }
  if ("purpose" in updates && !String(updates.purpose || "").trim()) {
    return NextResponse.json({ error: "Purpose can't be empty" }, { status: 400 });
  }
  if ("email" in updates && updates.email) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email);
    if (!emailOk) {
      return NextResponse.json({ error: "That email address doesn't look valid" }, { status: 400 });
    }
  }
  if ("additional_visitor_count" in updates) {
    const n = Number(updates.additional_visitor_count);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Additional visitor count must be 0 or more" }, { status: 400 });
    }
    updates.additional_visitor_count = Math.floor(n);
  }
  if ("email" in updates) updates.email = updates.email || null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("visitors")
    .update(updates)
    .eq("id", params.id)
    .select("*, hosts(name, email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visitor: data });
}
