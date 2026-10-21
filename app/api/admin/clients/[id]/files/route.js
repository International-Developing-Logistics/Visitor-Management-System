import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { uploadPrivateFile, signMany } from "@/lib/storage";

const BUCKET = "client-files";

// GET /api/admin/clients/[id]/files - this client's files with signed
// URLs (also included in GET .../clients/[id]; kept as its own route too
// so the file manager can refresh just the file list after an upload).
export async function GET(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: files, error } = await supabaseAdmin
    .from("client_files")
    .select("*")
    .eq("client_id", params.id)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signedMap = await signMany(supabaseAdmin, BUCKET, (files || []).map((f) => f.storage_path), 600);
  const withUrls = (files || []).map((f) => ({ ...f, signed_url: signedMap.get(f.storage_path) || null }));
  return NextResponse.json({ files: withUrls });
}

// POST /api/admin/clients/[id]/files { file_name, content_type, size_bytes, data, downloadable? }
// Uploads a file for this client. `data` is a data URL (same pattern as
// every other file upload in this app - see lib/storage.js). Storage path
// is namespaced by client_id so a leaked/guessed path alone can't reach
// another client's file.
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { file_name, content_type, size_bytes, data, downloadable } = await req.json();
  const cleanName = String(file_name || "").trim();
  if (!cleanName) return NextResponse.json({ error: "File name is required" }, { status: 400 });
  if (!data) return NextResponse.json({ error: "No file data received" }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const safeName = cleanName.replace(/[^A-Za-z0-9_.-]+/g, "_");
    const storagePath = await uploadPrivateFile(supabaseAdmin, BUCKET, `${params.id}/${randomUUID()}-${safeName}`, data);

    const { data: row, error } = await supabaseAdmin
      .from("client_files")
      .insert({
        client_id: params.id,
        file_name: cleanName,
        storage_path: storagePath,
        content_type: content_type || null,
        size_bytes: size_bytes || null,
        downloadable: downloadable !== false,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ file: row });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
