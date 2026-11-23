"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility } from "@/lib/facilityContext";
import { buildZip } from "@/lib/zip";
import { warehouseZipName, warehouseZipEntryName } from "@/lib/warehousePhotos";

// Builds the ZIP in the browser from the signed photo URLs. Done
// client-side on purpose: a server-built ZIP of 20+ photos would exceed
// Vercel's 4.5MB function response limit.
async function downloadZip(submission) {
  const files = await Promise.all(
    submission.photos.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Photo ${i + 1} could not be downloaded (${res.status})`);
      return { name: warehouseZipEntryName(submission, i), data: new Uint8Array(await res.arrayBuffer()) };
    })
  );
  const zip = buildZip(files, new Date(submission.created_at));
  const href = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = warehouseZipName(submission);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

function DownloadZipButton({ submission }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="btn-small"
        disabled={busy || submission.photos.length === 0}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await downloadZip(submission);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing ZIP…" : `Download ZIP (${submission.photos.length} photo${submission.photos.length === 1 ? "" : "s"})`}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function SubmissionCard({ submission }) {
  const count = submission.photo_paths?.length || 0;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700 }}>GRN {submission.grn}</div>
          <div className="helper-text" style={{ marginTop: 2 }}>
            {submission.client_name} · {submission.container_count} container{submission.container_count === 1 ? "" : "s"}
          </div>
        </div>
        <div className="helper-text" style={{ textAlign: "right", marginTop: 0 }}>
          {submission.staff_name}
          <br />
          {formatInCompanyTimezone(submission.created_at)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gap: 8,
          marginTop: 12,
        }}
      >
        {submission.photos.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", aspectRatio: "1 / 1" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`GRN ${submission.grn} photo ${i + 1}`}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
            />
          </a>
        ))}
      </div>
      {submission.photos.length < count && (
        <p className="helper-text">{count - submission.photos.length} photo(s) couldn't be loaded.</p>
      )}
      <DownloadZipButton submission={submission} />
    </div>
  );
}

export default function AdminWarehousePhotosPage() {
  const { facility } = useFacility();
  const [submissions, setSubmissions] = useState([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ facility });
      if (query) params.set("q", query);
      const res = await authFetch(`/api/admin/warehouse-photos?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmissions(data.submissions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [facility, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Warehouse Photos</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Photos submitted by warehouse staff from the Staff Hub. Click a photo to open it full size.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 480 }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by GRN or client"
          style={{ marginBottom: 0 }}
        />
        <button type="submit" className="btn-small">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && submissions.length === 0 && (
        <p className="helper-text">{query ? "No submissions match that search." : "No submissions yet."}</p>
      )}

      {!loading && submissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
    </div>
  );
}
