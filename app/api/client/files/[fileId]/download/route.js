import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireClient } from "@/lib/verifyClient";
import { signMany } from "@/lib/storage";

const BUCKET = "client-files";

// GET /api/client/files/[fileId]/download
// This is THE isolation guarantee for the Client Portal: it never trusts
// the fileId alone. It loads the file's own row and checks
// file.client_id === caller.clientId before issuing a signed URL - a
// guessed or shared fileId for another client's file gets 404, not a
// signed URL. Also refuses files the admin has marked non-downloadable,
// enforced here rather than only hidden in the UI.
export async function GET(req, { params }) {
  const client = await requireClient(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: file, error } = await supabaseAdmin
    .from("client_files")
    .select("id, client_id, storage_path, downloadable")
    .eq("id", params.fileId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!file || file.client_id !== client.clientId) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!file.downloadable) {
    return NextResponse.json({ error: "This file isn't available for download" }, { status: 403 });
  }

  const signedMap = await signMany(supabaseAdmin, BUCKET, [file.storage_path], 120);
  const url = signedMap.get(file.storage_path);
  if (!url) return NextResponse.json({ error: "Could not generate a download link" }, { status: 500 });

  return NextResponse.json({ url });
}
