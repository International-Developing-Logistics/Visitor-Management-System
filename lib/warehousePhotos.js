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
