import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const EDITABLE_FIELDS = ["full_name", "email", "resident_id", "company", "estimated_duration"];

// PATCH /api/admin/contractors/[id]
// Body can include any editable field, plus:
//   status: "active" | "inactive" | "pending"
//   validity_start / validity_end: ISO strings or "" to clear
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if ("status" in body) {
    if (!["pending", "active", "inactive"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if ("validity_start" in body) {
    updates.validity_start = body.validity_start ? new Date(body.validity_start).toISOString() : null;
  }
  if ("validity_end" in body) {
    updates.validity_end = body.validity_end ? new Date(body.validity_end).toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  if ("full_name" in updates && !String(updates.full_name || "").trim()) {
    return NextResponse.json({ error: "Full name can't be empty" }, { status: 400 });
  }
  if ("email" in updates && updates.email) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email);
    if (!emailOk) {
      return NextResponse.json({ error: "That email address doesn't look valid" }, { status: 400 });
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("contractors")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contractor: data });
}
