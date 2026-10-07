"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [logins, setLogins] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/clients/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClient(data.client);
      setLogins(data.logins || []);
      setFiles(data.files || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async () => {
    setInviting(true);
    setInviteError("");
    try {
      const res = await authFetch(`/api/admin/clients/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteEmail("");
      await load();
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const data = await readFileAsDataUrl(file);
      const res = await authFetch(`/api/admin/clients/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, content_type: file.type, size_bytes: file.size, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await load();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleDownloadable = async (fileId, next) => {
    setTogglingId(fileId);
    try {
      const res = await authFetch(`/api/admin/clients/${id}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadable: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, downloadable: next } : f)));
    } catch (e) {
      setError(e.message);
    } finally {
      setTogglingId("");
    }
  };

  const removeFile = async (fileId) => {
    setDeletingId(fileId);
    try {
      const res = await authFetch(`/api/admin/clients/${id}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId("");
    }
  };

  if (loading) return <div className="admin-card"><p className="helper-text">Loading…</p></div>;
  if (error && !client) return <div className="admin-card"><p className="error-text">{error}</p></div>;
  if (!client) return null;

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>{client.name}</h3>
      <p className="helper-text" style={{ marginBottom: 20 }}>
        Created {formatInCompanyTimezone(client.created_at)}{client.facility ? ` · ${client.facility}` : ""}
      </p>

      <section style={{ marginBottom: 28 }}>
        <h4 style={{ marginBottom: 10 }}>Logins</h4>
        <div className="admin-form-inline">
          <div>
            <label>Invite a login by email</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="contact@client.com" />
          </div>
          <button className="btn-small" onClick={invite} disabled={inviting || !inviteEmail.trim()} style={{ height: 42 }}>
            {inviting ? "Sending invite…" : "Send invite"}
          </button>
        </div>
        {inviteError && <p className="error-text" style={{ marginTop: -10, marginBottom: 16 }}>{inviteError}</p>}

        {logins.length === 0 ? (
          <p className="helper-text">No logins invited yet.</p>
        ) : (
          <div className="vtable-scroll">
            <table className="vtable">
              <thead><tr><th>Email</th><th>Created</th></tr></thead>
              <tbody>
                {logins.map((l) => (
                  <tr key={l.user_id}>
                    <td>{l.email}</td>
                    <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 style={{ marginBottom: 10 }}>Files</h4>
        <label className="btn-small" style={{ cursor: "pointer", display: "inline-block", marginBottom: 10 }}>
          {uploading ? "Uploading…" : "+ Upload file"}
          <input type="file" style={{ display: "none" }} onChange={uploadFile} disabled={uploading} />
        </label>
        {uploadError && <p className="error-text">{uploadError}</p>}
        {error && <p className="error-text">{error}</p>}

        {files.length === 0 ? (
          <p className="helper-text">No files uploaded yet.</p>
        ) : (
          <div className="vtable-scroll">
            <table className="vtable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Downloadable</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>
                      {f.signed_url ? <a href={f.signed_url} target="_blank" rel="noreferrer">{f.file_name}</a> : f.file_name}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{f.content_type || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{formatSize(f.size_bytes)}</td>
                    <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(f.uploaded_at)}</td>
                    <td>
                      <select
                        value={f.downloadable ? "yes" : "no"}
                        disabled={togglingId === f.id}
                        onChange={(e) => toggleDownloadable(f.id, e.target.value === "yes")}
                        style={{ width: "auto" }}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">View only</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn-small" disabled={deletingId === f.id} onClick={() => removeFile(f.id)}>
                        {deletingId === f.id ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
