"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";

const ROLES = ["admin", "guard", "staff"];

const ROLE_HELP = {
  admin: "Full access - everything under /admin, plus /guard.",
  guard: "Gate Operations and Security Log only - no /admin access.",
  staff: "Staff Hub, Vehicle Request, Equipment Request, Request-Invite only.",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("guard");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
      setCurrentUserId(data.currentUserId || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (id, role) => {
    setSavingId(id);
    setError("");
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } catch (e) {
      setError(e.message);
      await load(); // role select could be left showing the failed value - resync from the server
    } finally {
      setSavingId("");
    }
  };

  const invite = async () => {
    setInviting(true);
    setInviteError("");
    try {
      const res = await authFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteEmail("");
      setInviteRole("guard");
      await load();
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Users & Roles</h3>
      <p className="helper-text" style={{ marginTop: 0, marginBottom: 20 }}>
        Any login with no role set here defaults to full admin access - that's what keeps every
        account created before this page existed working exactly as before.
      </p>

      <div className="admin-form-inline">
        <div>
          <label>Invite by email</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label>Starting role</label>
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <button
          className="btn-small"
          onClick={invite}
          disabled={inviting || !inviteEmail.trim()}
          style={{ height: 42 }}
        >
          {inviting ? "Sending invite…" : "Send invite"}
        </button>
      </div>
      <p className="helper-text" style={{ marginTop: -10, marginBottom: 20 }}>
        {ROLE_HELP[inviteRole]}
      </p>
      {inviteError && <p className="error-text" style={{ marginTop: -10, marginBottom: 20 }}>{inviteError}</p>}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}

      {!loading && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.email}
                      {isSelf && <span className="helper-text" style={{ marginLeft: 6 }}>(you)</span>}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className={`badge role-${u.role}`}>{u.role}</span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={savingId === u.id}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{u.created_at ? formatInCompanyTimezone(u.created_at) : "-"}</td>
                    <td>{u.last_sign_in_at ? formatInCompanyTimezone(u.last_sign_in_at) : "Never"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
