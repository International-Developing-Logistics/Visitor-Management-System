"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { FACILITIES } from "@/lib/facilities";

export default function AdminClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [facility, setFacility] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClients(data.clients || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await authFetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), facility: facility || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setName("");
      setFacility("");
      await load();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Clients</h3>
      <p className="helper-text" style={{ marginTop: 0, marginBottom: 20 }}>
        Each client is its own account with logins and files kept separate from every other client
        and from this operations system - see a client's page to invite a login or manage their files.
      </p>

      <div className="admin-form-inline">
        <div>
          <label>Client name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Trading LLC" />
        </div>
        <div>
          <label>Facility (optional)</label>
          <select value={facility} onChange={(e) => setFacility(e.target.value)}>
            <option value="">—</option>
            {Object.values(FACILITIES).map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-small" onClick={create} disabled={creating || !name.trim()} style={{ height: 42 }}>
          {creating ? "Creating…" : "Create client"}
        </button>
      </div>
      {createError && <p className="error-text" style={{ marginTop: -10, marginBottom: 20 }}>{createError}</p>}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && clients.length === 0 && <p className="helper-text">No clients yet.</p>}

      {!loading && clients.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Facility</th>
                <th>Logins</th>
                <th>Files</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/admin/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.facility ? FACILITIES[c.facility]?.label || c.facility : "—"}</td>
                  <td>{c.login_count}</td>
                  <td>{c.file_count}</td>
                  <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
