// Shared rules for the Warehouse Photos form (Staff Hub) and its API.

export const WAREHOUSE_PHOTOS_BUCKET = "warehouse-photos";

// Staff usually add 5-20 photos per GRN; allow some headroom.
export const MAX_PHOTOS = 30;

// Photos are resized/compressed in the browser before upload (see
// components/WarehousePhotosForm.jsx), so each one ends up well under this.
// The bucket itself also rejects anything over 5MB or not JPEG.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Longest edge after resizing, and JPEG quality. ~1600px keeps labels and
// damage clearly readable while landing around 200-500KB per photo, which
// matters on the Supabase Free plan's 1GB of file storage.
export const PHOTO_MAX_DIMENSION = 1600;
export const PHOTO_JPEG_QUALITY = 0.8;

/** Storage path for photo `index` (0-based) of a submission. */
export function warehousePhotoPath(submissionId, index) {
  return `${submissionId}/${String(index + 1).padStart(2, "0")}.jpg`;
}

// Who gets an email (with the photos zipped) for every submission.
// Override with the WAREHOUSE_PHOTOS_EMAIL env var (comma-separated for
// several people) - server-side only.
export const DEFAULT_WAREHOUSE_PHOTOS_EMAIL = "mojtaba@idllogistics.ae";

// Resend's limit is 40MB per email (after base64 encoding, which adds
// ~33%), so only attach ZIPs comfortably below that. Compressed photos are
// ~0.2-0.5MB each, so even 30 photos normally land well under this.
export const MAX_EMAIL_ZIP_BYTES = 25 * 1024 * 1024;

function safePart(text, fallback) {
  const cleaned = String(text || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

/** ZIP file name for a submission, e.g. "GRN-12345_ACME-Trading.zip". */
export function warehouseZipName(submission) {
  return `GRN-${safePart(submission.grn, "unknown")}_${safePart(submission.client_name, "client")}.zip`;
}

/** Name of photo `index` (0-based) inside the ZIP, e.g. "GRN-12345-01.jpg". */
export function warehouseZipEntryName(submission, index) {
  return `GRN-${safePart(submission.grn, "unknown")}-${String(index + 1).padStart(2, "0")}.jpg`;
}
