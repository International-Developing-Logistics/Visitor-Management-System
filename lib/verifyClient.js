import { getSupabaseAdmin } from "./supabaseClient";

/**
 * Verifies the "Authorization: Bearer <access_token>" header against
 * Supabase Auth, then resolves that account against client_accounts ONLY.
 * No match means unauthorized, full stop - there is deliberately no
 * default-grant fallback here the way lib/verifyAdmin.js has one for
 * staff (no user_roles row = admin). A client account that somehow has no
 * client_accounts row is not a client at all as far as this app is
 * concerned, and gets nothing.
 *
 * Use this for every /api/client/** route. Returns { user, clientId } or
 * null.
 */
export async function requireClient(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: accountRow } = await supabaseAdmin
    .from("client_accounts")
    .select("client_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!accountRow) return null;

  return { user: data.user, clientId: accountRow.client_id };
}
