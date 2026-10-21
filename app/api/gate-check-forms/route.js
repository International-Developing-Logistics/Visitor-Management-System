import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireAdminOrGuard } from "@/lib/verifyAdmin";
import { uploadPrivateFile } from "@/lib/storage";
import { DEFAULT_FACILITY } from "@/lib/facilities";

const BUCKET = "gate-check-forms";

// POST /api/gate-check-forms
// { facility, form_no, fields, signatures, stamp_photo, photos }
// Admin or guard only (requireAdminOrGuard) - same tier as Gate Operations
// and the Security Log. Uploads every signature/stamp/photo data URL to a
// private Storage bucket and stores only the resulting paths in the row;
// see CLIENT_PORTAL_AND_GATE_CHECK_DESIGN.md Part A for the full schema.
export async function POST(req) {
  const user = await requireAdminOrGuard(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkRateLimit(req, "gate-check-forms");
  if (limited) return limited;

  const body = await req.json();
  const { facility, form_no, fields, signatures, stamp_photo, photos } = body;

  if (!form_no || !form_no.trim()) {
    return NextResponse.json({ error: "Form No. is required" }, { status: 400 });
  }
  if (!fields || typeof fields !== "object") {
    return NextResponse.json({ error: "Missing form fields" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const id = randomUUID();

  try {
    // Signatures - each role may carry a drawn signature image.
    const storedSignatures = {};
    for (const [role, sig] of Object.entries(signatures || {})) {
      if (!sig) continue;
      let photoPath = null;
      if (sig.signature) {
        photoPath = await uploadPrivateFile(supabaseAdmin, BUCKET, `${id}/signatures/${role}.png`, sig.signature);
      }
      storedSignatures[role] = { name: sig.name || "", time: sig.time || "", acknowledged: sig.acknowledged, photo_path: photoPath };
    }

    const stampPath = stamp_photo
      ? await uploadPrivateFile(supabaseAdmin, BUCKET, `${id}/stamp.jpg`, stamp_photo)
      : null;

    const storedPhotos = [];
    for (const p of photos || []) {
      if (p.image) {
        const photoPath = await uploadPrivateFile(supabaseAdmin, BUCKET, `${id}/photos/${p.field}.jpg`, p.image);
        storedPhotos.push({
          field: p.field,
          label: p.label,
          taken_at: p.takenAt || null,
          taken_source: p.takenSource || null,
          gps: p.gps || null,
          original_name: p.originalName || null,
          photo_path: photoPath,
        });
      } else {
        storedPhotos.push({ field: p.field, label: p.label, status: "not_captured" });
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("gate_check_forms")
      .insert({
        id,
        facility: facility || DEFAULT_FACILITY,
        form_no: form_no.trim(),
        container_no: (fields.containerNo || "").toUpperCase() || null,
        truck_plate: (fields.truckPlate || "").toUpperCase() || null,
        driver_name: fields.driverName || null,
        decision: ["Accept", "Hold", "Reject"].includes(fields.decision) ? fields.decision : null,
        check_date: fields.date || null,
        fields,
        signatures: storedSignatures,
        stamp_photo_path: stampPath,
        photos: storedPhotos,
        submitted_by: user.id,
        submitted_by_email: user.email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ form: row });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
