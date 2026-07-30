function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  return Buffer.from(base64, "base64");
}

/**
 * Uploads a data URL to a PRIVATE bucket and returns the storage path
 * (not a public URL — the bucket has no public access). Callers store this
 * path in the DB and sign it on demand with signOne/signMany below.
 */
export async function uploadPrivateFile(supabaseAdmin, bucket, path, dataUrl) {
  const buffer = dataUrlToBuffer(dataUrl);
  const contentType = dataUrl.substring(5, dataUrl.indexOf(";"));
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed (${bucket}/${path}): ${error.message}`);
  return path;
}

/** Signs a single storage path. expiresIn is in seconds. */
export async function signOne(supabaseAdmin, bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Signs many storage paths in one call. Returns a Map of path -> signedUrl.
 * Skips nulls/duplicates so callers can pass raw arrays straight from rows.
 */
export async function signMany(supabaseAdmin, bucket, paths, expiresIn = 300) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error || !data) return new Map();

  const map = new Map();
  data.forEach((entry) => {
    if (entry.signedUrl) map.set(entry.path, entry.signedUrl);
  });
  return map;
}
