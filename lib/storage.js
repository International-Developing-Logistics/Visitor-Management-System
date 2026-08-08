function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  return Buffer.from(base64, "base64");
}

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
