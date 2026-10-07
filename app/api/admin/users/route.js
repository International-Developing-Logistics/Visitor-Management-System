import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const VALID_ROLES = ["admin", "guard", "staff"];

// GET /api/admin/users - lists every Supabase Auth login alongside its
// user_roles row. Accounts with no user_roles row default to "admin" (see
// lib/verifyAdmin.js and supabase/migration_user_roles.sql) - that default
// is mirrored here so the list always matches what requireAdmin() actually
// enforces.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role");
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  const roleByUserId = new Map((roleRows || []).map((r) => [r.user_id, r.role]));

  const users = authData.users
    .map((u) => ({
      id: u.id,
      email: u.email,
      role: roleByUserId.get(u.id) || "admin",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
    }))
    .sort((a, b) => (a.email || "").localeCompare(b.email || ""));

  return NextResponse.json({ users, currentUserId: user.id });
}

// POST /api/admin/users - invites a brand-new login by email (Supabase
// sends its own invite/magic-link email - no Resend involved) and records
// its starting role in one step, so day-to-day account setup never needs
// the Supabase dashboard.
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role } = await req.json();
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  if (!emailOk) return NextResponse.json({ error: "That email address doesn't look valid" }, { status: 400 });
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be admin, guard, or staff" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail);
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  const newUserId = inviteData.user.id;
  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: newUserId, email: cleanEmail, role });
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });

  return NextResponse.json({
    user: { id: newUserId, email: cleanEmail, role, created_at: inviteData.user.created_at, last_sign_in_at: null },
  });
}
