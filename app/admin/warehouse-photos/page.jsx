"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";
import { useFacility } from "@/lib/facilityContext";

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
          type="search"
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
