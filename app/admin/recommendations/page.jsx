"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { formatInCompanyTimezone } from "@/lib/timezone";

const STATUS_LABEL = { new: "New", planned: "Planned", done: "Done", declined: "Declined" };
const STATUS_BADGE_CLASS = { new: "requested", planned: "gate_pending", done: "checked_in", declined: "gate_denied" };
const STATUSES = ["new", "planned", "done", "declined"];

function RecommendationRow({ rec, onSaved }) {
  const [notes, setNotes] = useState(rec.admin_notes || "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const patch = async (body, setSaving) => {
    setSaving(true);
    try {
      const res = await authFetch(`/api/admin/recommendations/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      onSaved(data.recommendation);
    } catch {
      // best-effort UI; the row just won't reflect the change
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{rec.description}</p>
        <span className={`badge ${STATUS_BADGE_CLASS[rec.status]}`} style={{ flexShrink: 0 }}>
          {STATUS_LABEL[rec.status]}
        </span>
      </div>

      <p className="helper-text" style={{ marginTop: 8, marginBottom: 12 }}>
        Submitted anonymously · {formatInCompanyTimezone(rec.created_at)}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <label htmlFor={`status-${rec.id}`} style={{ margin: 0, fontSize: "0.85rem" }}>Status</label>
        <select
          id={`status-${rec.id}`}
          value={rec.status}
          disabled={savingStatus}
          onChange={(e) => patch({ status: e.target.value }, setSavingStatus)}
          style={{ width: "auto" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <label htmlFor={`notes-${rec.id}`} style={{ fontSize: "0.85rem" }}>Admin notes (optional, internal only)</label>
      <textarea
        id={`notes-${rec.id}`}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        className="btn-small"
        onClick={() => patch({ admin_notes: notes }, setSavingNotes)}
        disabled={savingNotes || notes === (rec.admin_notes || "")}
      >
        {savingNotes ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}

export default function AdminRecommendationsPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/recommendations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecommendations(data.recommendations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (updated) => {
    setRecommendations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className="admin-card">
      <h3 style={{ marginBottom: 4 }}>Feature recommendations</h3>
      <p className="helper-text" style={{ marginBottom: 16 }}>
        Submitted anonymously from the Staff Hub and Guard Station — no submitter identity is captured.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && recommendations.length === 0 && <p className="helper-text">No recommendations yet.</p>}

      {!loading &&
        recommendations.map((rec) => (
          <RecommendationRow key={rec.id} rec={rec} onSaved={handleSaved} />
        ))}
    </div>
  );
}
