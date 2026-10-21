import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

const VALID_ROLES = ["admin", "guard", "staff"];

// PATCH /api/admin/users/[id] - changes an existing login's role. Blocked
// for your own account on purpose: an admin demoting themselves here would
// lock them out of /admin with no UI left to undo it from. Changing your
// own role still works the documented manual way (Supabase Table Editor).
export async function PATCH(req, { params }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.id === user.id) {
    return NextResponse.json({ error: "You can't change your own role here" }, { status: 400 });
  }

  const { role } = await req.json();
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be admin, guard, or staff" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: targetUser, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(params.id);
  if (lookupError || !targetUser?.user) {
    return NextResponse.json({ error: "That account doesn't exist" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: params.id, email: targetUser.user.email, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: { id: params.id, email: targetUser.user.email, role } });
}
