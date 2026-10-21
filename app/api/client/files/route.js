import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireClient } from "@/lib/verifyClient";

// GET /api/client/files - lists only the caller's own files (scoped by
// clientId resolved from client_accounts, never from anything the caller
// supplies). No signed URLs here - those are issued one at a time by
// .../[fileId]/download so every download re-checks ownership and the
// downloadable flag at the moment of the click, not when the list loaded.
export async function GET(req) {
  const client = await requireClient(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("client_files")
    .select("id, file_name, content_type, size_bytes, downloadable, uploaded_at")
    .eq("client_id", client.clientId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
