"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandHeader from "@/components/BrandHeader";
import { authFetch } from "@/lib/apiFetch";
import { supabase } from "@/lib/supabaseClient";
import { formatInCompanyTimezone } from "@/lib/timezone";

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientPortalPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/client/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/client/login");
  };

  const download = async (file) => {
    setDownloadingId(file.id);
    try {
      const res = await authFetch(`/api/client/files/${file.id}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <>
      <div className="kiosk-header">
        <BrandHeader label="Client Portal" />
        <button className="btn-small" onClick={signOut}>Sign out</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>My Files</h3>
        <p className="helper-text" style={{ marginBottom: 16 }}>
          Files made available to you. Only you can see this list.
        </p>

        {error && <p className="error-text">{error}</p>}
        {loading && <p className="helper-text">Loading…</p>}
        {!loading && files.length === 0 && <p className="helper-text">No files yet.</p>}

        {!loading && files.length > 0 && (
          <div className="vtable-scroll">
            <table className="vtable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.file_name}</td>
                    <td style={{ fontSize: "0.82rem" }}>{f.content_type || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>{formatSize(f.size_bytes)}</td>
                    <td style={{ fontSize: "0.82rem" }}>{formatInCompanyTimezone(f.uploaded_at)}</td>
                    <td>
                      {f.downloadable ? (
                        <button className="btn-small" onClick={() => download(f)} disabled={downloadingId === f.id}>
                          {downloadingId === f.id ? "Opening…" : "Download"}
                        </button>
                      ) : (
                        <span className="helper-text" style={{ margin: 0 }}>Not downloadable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
