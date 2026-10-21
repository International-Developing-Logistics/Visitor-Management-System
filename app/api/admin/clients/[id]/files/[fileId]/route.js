import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const BUCKET = "client-files";

// PATCH /api/admin/clients/[id]/files/[fileId] { downloadable } - toggles
// a file between downloadable and view-only. "View-only" is enforced
// server-side by /api/client/files/[fileId]/download refusing to sign a
// URL when downloadable is false, not just hidden in the client UI.
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { downloadable } = await req.json();
  if (typeof downloadable !== "boolean") {
    return NextResponse.json({ error: "downloadable must be true or false" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: row, error } = await supabaseAdmin
    .from("client_files")
    .update({ downloadable })
    .eq("id", params.fileId)
    .eq("client_id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.json({ file: row });
}

// DELETE /api/admin/clients/[id]/files/[fileId] - removes both the
// Storage object and the row. Deliberately scoped by client_id too (not
// just fileId) so this can never touch another client's file even if a
// caller somehow got the wrong id pair.
export async function DELETE(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("client_files")
    .select("id, storage_path")
    .eq("id", params.fileId)
    .eq("client_id", params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "File not found" }, { status: 404 });

  await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);

  const { error } = await supabaseAdmin.from("client_files").delete().eq("id", params.fileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
