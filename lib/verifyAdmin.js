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
 * (/api/guard-logs, /api/guard/gate-status, /api/guard/vehicle-movements,
 * /api/guard/vehicle-requests) — things a guard genuinely needs, which an
 * admin can also do.
 *
 * Renamed from requireStaff() now that "staff" is a real, separate DB
 * role: the old name would have been misleading (and the old
 * implementation never actually checked role at all — it accepted any
 * signed-in account. That was harmless while only admin/guard existed,
 * but would have silently let staff accounts hit these guard-only
 * endpoints, so the role check below is now enforced for real).
 */
export async function requireAdminOrGuard(req) {
  const result = await getUserAndRole(req);
  if (!result || (result.role !== "admin" && result.role !== "guard")) return null;
  return result.user;
}

/**
 * Any of the given roles. Use this for endpoints shared by a specific set
 * of roles that isn't just "admin" or "admin or guard" — e.g. the staff
 * tools (Vehicle Request, Equipment Request, Request-Invite), which are
 * open to admin and staff but not guard.
 */
export async function requireRole(req, allowedRoles) {
  const result = await getUserAndRole(req);
  if (!result || !allowedRoles.includes(result.role)) return null;
  return result.user;
}

/**
 * Any signed-in account, regardless of role — admin, staff, or guard.
 * Use this instead of hardcoding the full role list at each call site
 * (which would silently go stale if a role is ever added or renamed).
 * Currently used by /api/recommendations, open to every employee.
 */
export async function requireAnyRole(req) {
  const result = await getUserAndRole(req);
  return result ? result.user : null;
}
