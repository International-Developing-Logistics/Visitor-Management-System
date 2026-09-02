import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { sendContractorPassActivatedEmail, sendContractorRegistrationApprovedEmail } from "@/lib/email";

const EDITABLE_FIELDS = ["full_name", "email", "resident_id", "company", "estimated_duration"];

// PATCH /api/admin/contractors/[id]
// Body can include any editable field, plus:
//   status: "pending" | "active" | "inactive" | "denied"
//   validity_start / validity_end: ISO strings or "" to clear
//   denial_reason: optional text, only meaningful alongside status: "denied"
//
// Approving is just status: "active" — there's no separate resting
// "approved" state; a pending registration goes straight to active the
// moment an admin approves it, same one PATCH the existing Activate button
// already used. On approval, both the contractor (their pass link) and the
// two ADMIN_NOTIFICATION_EMAIL / HR_NOTIFICATION_EMAIL recipients get
// emailed — same two addresses used for gate approvals and the original
// "registration submitted" notice. Denying is status: "denied", optionally
// with a reason that's stored for admins only — a denial is never emailed
// to anyone, it's visible only in the admin dashboard.
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  if ("status" in body) {
    if (!["pending", "active", "inactive", "denied"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if ("denial_reason" in body) {
    updates.denial_reason = body.denial_reason ? String(body.denial_reason).trim() : null;
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

  // Check the prior status so we only email / stamp decided_at on an
  // actual pending -> active or pending -> denied decision, not every save
  // while already in that state (e.g. editing details on an active pass).
  const { data: before } = await supabaseAdmin.from("contractors").select("status").eq("id", params.id).single();
  const isActivating = "status" in updates && updates.status === "active" && before?.status !== "active";
  const isDenying = "status" in updates && updates.status === "denied" && before?.status !== "denied";

  if (isActivating || isDenying) {
    updates.decided_at = new Date().toISOString();
  }
  // A denial reason only makes sense attached to an actual denial — clear
  // any stale one if this save moves the record to a non-denied status.
  if ("status" in updates && updates.status !== "denied" && !("denial_reason" in updates)) {
    updates.denial_reason = null;
  }

  const { data, error } = await supabaseAdmin
    .from("contractors")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isActivating) {
    const origin = req.nextUrl.origin;
    const passUrl = `${origin}/contractor-pass?token=${data.pass_token}`;
    await sendContractorPassActivatedEmail({ contractor: data, passUrl }).catch((err) =>
      console.error("[contractors] activation email failed:", err.message)
    );
    await sendContractorRegistrationApprovedEmail({ contractor: data, reviewUrl: `${origin}/admin/contractors` }).catch((err) =>
      console.error("[contractors] approval notification email failed:", err.message)
    );
  }
  // Denials are internal-only — no email is sent on isDenying, by design
  // (the reason and the decision itself stay in the admin dashboard).

  return NextResponse.json({ contractor: data });
}
