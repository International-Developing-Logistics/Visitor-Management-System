import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

// POST /api/admin/clients/[id]/invite { email } - invites a login for this
// client, mirroring the Users & Roles invite flow (same Supabase Auth
// inviteUserByEmail call) but writing to client_accounts instead of
// user_roles. Deliberately never touches user_roles - a client login must
// never pick up the "no row = admin" default (see lib/verifyAdmin.js).
export async function POST(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  if (!emailOk) return NextResponse.json({ error: "That email address doesn't look valid" }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  const newUserId = inviteData.user.id;
  const { error: linkError } = await supabaseAdmin
    .from("client_accounts")
    .upsert({ user_id: newUserId, client_id: params.id, email: cleanEmail });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  return NextResponse.json({ login: { user_id: newUserId, email: cleanEmail, created_at: inviteData.user.created_at } });
}
