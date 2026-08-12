import { supabase } from "./supabaseClient";

/**
 * Like fetch(), but attaches the current admin's Supabase access token so
 * /api/admin/** routes can verify the request. Redirects the caller to
 * /admin/login if there's no active session.
 */
export async function authFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    window.location.href = "/admin/login";
    throw new Error("Not signed in");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
