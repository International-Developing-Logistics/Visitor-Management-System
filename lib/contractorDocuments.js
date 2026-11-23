// Shared rules for contractor identity documents (registration page + API).

export const CONTRACTOR_DOCS_BUCKET = "contractor-documents";

// Files go straight from the browser to Supabase Storage (signed upload
// URLs), so they're no longer limited by Vercel's 4.5MB request body cap.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Storage slots each document option needs. Files are stored at
// `${upload_id}-${slot}` in the bucket.
export const SLOTS_BY_DOCUMENT_TYPE = {
  freezone_pass: ["freezone-pass"],
  passport_emirates_id: ["passport", "emirates-id"],
};
