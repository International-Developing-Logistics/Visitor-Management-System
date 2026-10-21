import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// GET /api/admin/clients - lists every client with its login and file
// counts, for the Clients index page.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, facility, created_at")
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: accountRows } = await supabaseAdmin.from("client_accounts").select("client_id");
  const { data: fileRows } = await supabaseAdmin.from("client_files").select("client_id");

  const loginCounts = new Map();
  (accountRows || []).forEach((r) => loginCounts.set(r.client_id, (loginCounts.get(r.client_id) || 0) + 1));
  const fileCounts = new Map();
  (fileRows || []).forEach((r) => fileCounts.set(r.client_id, (fileCounts.get(r.client_id) || 0) + 1));

  const list = (clients || []).map((c) => ({
    ...c,
    login_count: loginCounts.get(c.id) || 0,
    file_count: fileCounts.get(c.id) || 0,
  }));

  return NextResponse.json({ clients: list });
}

// POST /api/admin/clients { name, facility? } - creates a new client
// organization. No login yet - that's a separate step (see
// .../[id]/invite) so a client record can exist before anyone is invited.
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, facility } = await req.json();
  const cleanName = String(name || "").trim();
  if (!cleanName) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  if (facility && !["harmony", "idl"].includes(facility)) {
    return NextResponse.json({ error: "Facility must be harmony or idl" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .insert({ name: cleanName, facility: facility || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: { ...client, login_count: 0, file_count: 0 } });
}
