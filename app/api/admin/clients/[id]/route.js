import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { signMany } from "@/lib/storage";

const BUCKET = "client-files";

// GET /api/admin/clients/[id] - one client's detail: the client record,
// its logins (client_accounts), and its files with signed URLs - the
// Clients detail/manage page's single data source.
export async function GET(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: logins, error: loginsError } = await supabaseAdmin
    .from("client_accounts")
    .select("user_id, email, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: true });
  if (loginsError) return NextResponse.json({ error: loginsError.message }, { status: 500 });

  const { data: files, error: filesError } = await supabaseAdmin
    .from("client_files")
    .select("*")
    .eq("client_id", params.id)
    .order("uploaded_at", { ascending: false });
  if (filesError) return NextResponse.json({ error: filesError.message }, { status: 500 });

  const signedMap = await signMany(supabaseAdmin, BUCKET, (files || []).map((f) => f.storage_path), 600);
  const filesWithUrls = (files || []).map((f) => ({ ...f, signed_url: signedMap.get(f.storage_path) || null }));

  return NextResponse.json({ client, logins: logins || [], files: filesWithUrls });
}
