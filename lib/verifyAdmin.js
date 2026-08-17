import { getSupabaseAdmin } from "./supabaseClient";

/**
 * Verifies the "Authorization: Bearer <access_token>" header against
 * Supabase Auth, then resolves that user's role from the `user_roles`
 * table. Accounts with NO row there default to "admin" — this is what
 * keeps every pre-existing staff login working exactly as before, without
 * needing to backfill anything. Only accounts explicitly given a
 * `role = 'guard'` row are restricted.
 */
async function getUserAndRole(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return { user: data.user, role: roleRow?.role || "admin" };
}

/**
 * Admin-only. Use this for anything a guard should NOT be able to do:
 * editing visitors/hosts/contractors, exports, approving pre-registration
 * requests, sending guest invites, etc. — i.e. everything under
 * /api/admin/** except the guard-log endpoints.
 */
export async function requireAdmin(req) {
  const result = await getUserAndRole(req);
  if (!result || result.role !== "admin") return null;
  return result.user;
}

/**
 * Admin OR guard. Use this for the guard station's own endpoints
 * (/api/guard-logs, /api/guard/gate-status) — things a guard genuinely
 * needs, which an admin can also do.
 */
export async function requireStaff(req) {
  const result = await getUserAndRole(req);
  if (!result) return null;
  return result.user;
}
