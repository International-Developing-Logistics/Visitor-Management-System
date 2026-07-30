import { getSupabaseAdmin } from "./supabaseClient";

/**
 * Verifies the "Authorization: Bearer <access_token>" header against
 * Supabase Auth. Returns the authenticated user, or null if missing/invalid.
 * Use this at the top of any /api/admin/** route to keep it staff-only.
 */
export async function requireAdmin(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
