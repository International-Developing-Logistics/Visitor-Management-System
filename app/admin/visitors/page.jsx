"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiFetch";
import { useFacility } from "@/lib/facilityContext";
import { formatInCompanyTimezone } from "@/lib/timezone";
import EditVisitorModal from "@/components/EditVisitorModal";
import AddVisitorModal from "@/components/AddVisitorModal";
import VisitorHistoryModal from "@/components/VisitorHistoryModal";

// The unified Visitors page - consolidates what used to be scattered
// across "requested" (employee ask-for-an-invite), "invited"/"pre_registered"
// (pre-registration), "gate_pending"/"gate_approved"/"gate_denied"
// (walk-in gate approval), and "checked_in"/"checked_out", none of which
// previously had one admin screen. Every one of those underlying statuses
// still exists exactly as before in the database and other flows (email
// links, the gate/checkin pages, etc.) - this page only adds a display
// layer on top that groups them into four stages of one visit, per the
// "avoid the confusing status soup" ask.
//
// "did_not_visit" (added for Automatic Preregistration Tracking) lives in
// Completed - a pre-registration that's past its expected date without a
// check-in is just as "done" as one that was checked out, it just didn't
// happen. It's auto-applied by the "Run visitor housekeeping now" button
// below (or the optional pg_cron jobs in
// supabase/migration_visitor_did_not_visit.sql), and can be undone by hand
// with "Restore to Expected" if it fired on a visitor who actually showed
// up, or someone just wants another shot at the same pre-registration.
const TABS = [
  { key: "expected", label: "Expected", statuses: ["invited", "pre_registered", "requested"] },
  { key: "at_gate", label: "At Gate", statuses: ["gate_pending", "gate_approved"] },
  { key: "on_site", label: "On Site", statuses: ["checked_in"] },
  { key: "completed", label: "Completed", statuses: ["checked_out", "gate_denied", "did_not_visit"] },
];

const STATUS_BADGE = {
  invited: "invited",
  pre_registered: "pre_registered",
  requested: "requested",
  gate_pending: "gate_pending",
  gate_approved: "gate_approved",
  checked_in: "checked_in",
  checked_out: "checked_out",
  gate_denied: "gate_denied",
  did_not_visit: "did_not_visit",
};

const STATUS_LABEL = {
  invited: "Invited",
  pre_registered: "Pre-registered",
  requested: "Awaiting approval",
  gate_pending: "At gate",
  gate_approved: "Approved",
  checked_in: "On site",
  checked_out: "Checked out",
  gate_denied: "Denied",
  did_not_visit: "Did not visit",
};

// Group members are stored two ways depending on visitor type (see
// lib/visitorTypes.js): a structured {name, phone} array for Business/
// Client visitors, or a free-text names field for everyone else. This
// gives the table one consistent "who's in the party" string either way.
function partyNames(v) {
  if (Array.isArray(v.group_members) && v.group_members.length > 0) {
    return v.group_members.map((m) => `${m.name} (${m.phone})`).join(", ");
  }
  return v.additional_visitor_names || "";
}

// A returning visitor who's completed several separate visits used to show
// up as one near-identical row per visit in Completed, which reads as
// duplicates rather than history. This collapses them into a single row
// per phone number (keyed off the phone itself, not the phone_digits
// column, so it works even before that migration is run) - the most
// recent visit is shown, with a count of how many there were; the full
// breakdown is still one click away via the existing History button.
// Deliberately only used for the Completed tab (see below) - Expected/At
// Gate/On Site need one row per currently-active visit so a second
// pending visit for the same person never becomes unreachable.
const PHONE_GROUP_MIN_DIGITS = 7;

function phoneGroupKey(v) {
  const digits = (v.phone || "").replace(/\D/g, "");
  return digits.length >= PHONE_GROUP_MIN_DIGITS ? digits : `__id:${v.id}`;
}

function groupVisitsByPhone(list) {
  const groups = new Map();
  const order = [];
  for (const v of list) {
    const key = phoneGroupKey(v);
    if (!groups.has(key)) {
      // `list` arrives newest-first from the API, so the first row seen
      // for a key is already the most recent - it stays the representative.
      groups.set(key, { representative: v, count: 1, members: [v] });
      order.push(key);
    } else {
      const g = groups.get(key);
      g.count += 1;
      g.members.push(v);
    }
  }
  return order.map((key) => groups.get(key));
}

export default function AdminVisitorsPage() {
  const { facility } = useFacility();
  // Reads ?tab= on first render only (e.g. an Action Required link from
  // Home) - a plain lazy initializer instead of useSearchParams so this
  // page doesn't need a Suspense boundary just for a deep link.
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "expected";
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.key === t) ? t : "expected";
  });
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const [runningHousekeeping, setRunningHousekeeping] = useState(false);

  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusParam = activeTab.statuses.join(",");
      const res = await authFetch(`/api/admin/visitors?facility=${facility}&status=${statusParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitors(data.visitors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/hosts")
      .then((r) => r.json())
      .then((d) => setHosts(d.hosts || []))
      .catch(() => {});
  }, []);

  const runAction = async (id, fn) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const approveRequest = (id) =>
    runAction(id, async () => {
      const res = await authFetch(`/api/admin/requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send_email: false }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    });

  const gateDecide = (id, action) =>
    runAction(id, async () => {
      const res = await authFetch(`/api/admin/gate/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    });

  const checkIn = (id) =>
    runAction(id, async () => {
      const res = await authFetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    });

  const checkOut = (id) =>
    runAction(id, async () => {
      const res = await authFetch("/api/admin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    });

  // Undoes an automatic (or manual) "Did Not Visit" - e.g. the visitor
  // actually showed up outside normal hours, or housekeeping ran too
  // early. Goes back to "pre_registered" rather than "invited" since the
  // visitor already completed their details - they just need another
  // chance to be checked in.
  const restoreToExpected = (id) =>
    runAction(id, async () => {
      const res = await authFetch(`/api/admin/visitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pre_registered" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    });

  const runHousekeeping = async () => {
    setRunningHousekeeping(true);
    setError("");
    setNotice("");
    try {
      const res = await authFetch("/api/admin/visitors/expire-overdue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice(
        `Marked ${data.markedDidNotVisit} overdue pre-registration(s) as "Did Not Visit" and removed ${data.deletedStaleInvites} unanswered invite(s) older than a week.`
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunningHousekeeping(false);
    }
  };

  const q = search.trim().toLowerCase();
  const matchesQuery = (v) =>
    !q ||
    [v.full_name, v.email, v.phone, v.company, v.hosts?.name, v.visitor_type]
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(q));

  const filtered =
    activeTab.key === "completed"
      ? groupVisitsByPhone(visitors)
          .filter((g) => g.members.some(matchesQuery))
          .map((g) => ({ ...g.representative, __visitCount: g.count }))
      : visitors.filter(matchesQuery);

  return (
    <div className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Visitors</h3>
          <p className="helper-text" style={{ marginBottom: 16 }}>
            Everyone expected, at the gate, on site, or done - across pre-registrations, walk-ins, and guest
            invitations, in one place.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            className="btn-small"
            onClick={runHousekeeping}
            disabled={runningHousekeeping}
            style={{ whiteSpace: "nowrap" }}
          >
            {runningHousekeeping ? "Running…" : "Run housekeeping"}
          </button>
          <button
            className="btn-small"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => setAdding(true)}
          >
            + Add Visitor
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search name, email, phone, company, host…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>

      {notice && <p className="helper-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p className="helper-text">
          {q ? "No visitors match your search." : `Nobody in "${activeTab.label}" right now.`}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="vtable-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Type</th>
                <th>Company</th>
                <th>Host</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.full_name || "-"}</div>
                    <div className="helper-text" style={{ marginTop: 0 }}>{v.email || "-"}</div>
                    {v.additional_visitor_count > 0 && (
                      <div className="helper-text" style={{ marginTop: 0 }} title={partyNames(v) || undefined}>
                        Party of {v.additional_visitor_count + 1}
                      </div>
                    )}
                    {v.__visitCount > 1 && (
                      <div className="helper-text" style={{ marginTop: 0 }}>
                        {v.__visitCount} visits — showing most recent
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>{v.visitor_type || "-"}</td>
                  <td>{v.company || "-"}</td>
                  <td>{v.hosts?.name || "-"}</td>
                  <td style={{ maxWidth: 160 }}>
                    {v.purpose || (
                      <button className="btn-small" onClick={() => setEditing(v)}>+ Add purpose</button>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[v.status] || "invited"}`}>
                      {STATUS_LABEL[v.status] || v.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {formatInCompanyTimezone(v.checked_out_at || v.checked_in_at || v.created_at)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {v.status === "requested" && (
                        <button className="btn-small" onClick={() => approveRequest(v.id)} disabled={busyId === v.id}>
                          {busyId === v.id ? "…" : "Approve"}
                        </button>
                      )}
                      {(v.status === "invited" ||
                        v.status === "pre_registered" ||
                        v.status === "gate_approved" ||
                        v.status === "did_not_visit") && (
                        <button className="btn-small" onClick={() => checkIn(v.id)} disabled={busyId === v.id}>
                          {busyId === v.id ? "…" : "Check in"}
                        </button>
                      )}
                      {v.status === "did_not_visit" && (
                        <button className="btn-small" onClick={() => restoreToExpected(v.id)} disabled={busyId === v.id}>
                          Restore to Expected
                        </button>
                      )}
                      {v.status === "gate_pending" && (
                        <>
                          <button className="btn-small" onClick={() => gateDecide(v.id, "approve")} disabled={busyId === v.id}>
                            {busyId === v.id ? "…" : "Approve"}
                          </button>
                          <button className="btn-small" onClick={() => gateDecide(v.id, "deny")} disabled={busyId === v.id}>
                            Deny
                          </button>
                        </>
                      )}
                      {v.status === "checked_in" && (
                        <button className="btn-small" onClick={() => checkOut(v.id)} disabled={busyId === v.id}>
                          {busyId === v.id ? "…" : "Check out"}
                        </button>
                      )}
                      <button className="btn-small" onClick={() => setEditing(v)}>Edit</button>
                      {v.phone && (
                        <button className="btn-small" onClick={() => setHistoryFor(v)}>History</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditVisitorModal
          visitor={editing}
          hosts={hosts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {adding && (
        <AddVisitorModal
          hosts={hosts}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {historyFor && (
        <VisitorHistoryModal
          phone={historyFor.phone}
          fullName={historyFor.full_name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}
