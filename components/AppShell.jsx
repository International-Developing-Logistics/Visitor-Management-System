"use client";

// The unified application shell - one header + left sidebar used across
// the operations platform, replacing the old horizontal AdminNav. Phase 1
// of the IA overhaul: this wires up the Admin area only (role="admin").
// Staff and Security get their own entry points into this same shell in a
// later phase; the `role` prop and NAV filtering below are already
// written generically so that wiring is additive, not a rewrite.
//
// Items with no `href` are parts of the target navigation tree that don't
// have a page behind them yet (see the phase plan) - shown disabled with
// a "Soon" pill so the intended shape of the app is visible now, rather
// than silently missing.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/apiFetch";
import { FACILITIES, getFacility } from "@/lib/facilities";
import { useFacility, ALL_FACILITIES } from "@/lib/facilityContext";
import BrandHeader from "@/components/BrandHeader";

const SEARCH_TYPE_HREF_PARAM = {
  Visitor: "expected",
};

// Global search - item #10 of the IA overhaul. Admin-only (the backend
// route is requireAdmin, matching the full-record access it returns), so
// it only renders for role="admin". Debounced, small dropdown of results
// grouped loosely by type; picking one navigates to that item's list page
// (these pages don't support row-level deep links yet, so "land on the
// right screen" is the bar here, not "land on the exact row").
function GlobalSearch() {
  const router = useRouter();
  const { facility } = useFacility();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/admin/search?q=${encodeURIComponent(q)}&facility=${facility}`);
        const data = await res.json();
        setResults(res.ok ? data.results || [] : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, facility]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (r) => {
    setOpen(false);
    setQuery("");
    const tab = SEARCH_TYPE_HREF_PARAM[r.type];
    router.push(tab ? `${r.href}?tab=${tab}` : r.href);
  };

  return (
    <div ref={boxRef} style={{ position: "relative", flex: "1 1 auto", maxWidth: 320 }}>
      <input
        type="text"
        placeholder="Search visitors, contractors, requests…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        style={{ width: "100%" }}
      />
      {open && (query.trim().length >= 2) && (
        <div
          className="card"
          style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, padding: 8, maxHeight: 360, overflowY: "auto" }}
        >
          {loading && <p className="helper-text" style={{ margin: "6px 8px" }}>Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="helper-text" style={{ margin: "6px 8px" }}>No matches.</p>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => pick(r)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 8px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  borderRadius: 6,
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span className="helper-text" style={{ marginTop: 0, fontSize: "0.72rem" }}>{r.type}</span>
                </div>
                {r.subtitle && <div className="helper-text" style={{ marginTop: 0 }}>{r.subtitle}</div>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const NAV = [
  {
    group: null,
    items: [{ label: "Home", href: "/admin", roles: ["admin"] }],
  },
  {
    group: "People",
    items: [
      { label: "Visitors", href: "/admin/visitors", roles: ["admin"] },
      { label: "Guest Invitations", href: "/preregister", roles: ["admin"] },
      { label: "Contractors", href: "/admin/contractors", roles: ["admin"] },
      { label: "Contractor Movement", href: "/admin/contractor-visits", roles: ["admin"] },
      { label: "Hosts", href: "/admin/hosts", roles: ["admin"] },
    ],
  },
  {
    group: "Vehicles",
    items: [
      { label: "Requests", href: "/admin/vehicle-requests", roles: ["admin"] },
      { label: "Movement", href: "/admin/vehicle-movements", roles: ["admin"] },
      { label: "Fleet", href: null, roles: ["admin"] },
    ],
  },
  {
    group: "Equipment",
    items: [
      { label: "Log", href: "/admin/equipment-log", roles: ["admin"] },
      { label: "Print QR Labels", href: "/admin/equipment-log/print-labels", roles: ["admin"] },
      { label: "Requests (Archived)", href: "/admin/equipment-requests", roles: ["admin"] },
    ],
  },
  {
    group: "Security",
    items: [
      { label: "Gate Operations", href: "/guard", roles: ["admin"] },
      { label: "Security Log", href: "/admin/guard-logs", roles: ["admin"] },
      { label: "Incidents", href: null, roles: ["admin"] },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Activity", href: null, roles: ["admin"] },
      { label: "Reports", href: null, roles: ["admin"] },
      { label: "Audit Log", href: null, roles: ["admin"] },
    ],
  },
  {
    group: "Support",
    items: [
      { label: "IT Tickets", href: null, roles: ["admin"] },
      { label: "Feature Requests", href: "/admin/recommendations", roles: ["admin"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Users & Roles", href: "/admin/users", roles: ["admin"] },
      { label: "Facilities", href: null, roles: ["admin"] },
      { label: "Settings", href: null, roles: ["admin"] },
    ],
  },
];

export default function AppShell({ role = "admin", children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { facility, setFacility } = useFacility();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ""));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  // Sidebar branding follows the selected facility - falls back to the
  // default facility's logo/name when "All Facilities" is selected, since
  // there's no single facility to brand it with. Without this, the sidebar
  // silently used BrandHeader's generic fallbacks (a "Reception" title and
  // the Harmony logo) even while viewing the IDL facility.
  const activeFacility = getFacility(facility);

  return (
    <div className="app-shell">
      {mobileOpen && <div className="app-sidebar-scrim open" onClick={() => setMobileOpen(false)} />}

      <aside className={`app-sidebar${mobileOpen ? " open" : ""}`}>
        <div style={{ padding: "4px 10px 18px" }}>
          <BrandHeader
            label="Admin"
            companyName={activeFacility.label}
            logoSrc={activeFacility.logo}
            logoHeight={activeFacility.logoHeight}
          />
        </div>
        <nav>
          {groups.map((g) => (
            <div key={g.group || "top"}>
              {g.group && <div className="app-sidebar-group-label">{g.group}</div>}
              {g.items.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`app-sidebar-link${pathname === item.href ? " active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.label} className="app-sidebar-link soon">
                    {item.label}
                    <span className="app-sidebar-soon-pill">Soon</span>
                  </span>
                )
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <button
            className="app-sidebar-toggle btn-small"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            type="button"
          >
            ☰ Menu
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--muted)" }}>
            Facility:
            <select value={facility} onChange={(e) => setFacility(e.target.value)}>
              {Object.values(FACILITIES).map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
              {role === "admin" && <option value={ALL_FACILITIES}>All Facilities</option>}
            </select>
          </label>

          {role === "admin" && <GlobalSearch />}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
            {userEmail && (
              <span className="helper-text" style={{ marginTop: 0 }}>{userEmail}</span>
            )}
            <button onClick={signOut} className="btn-small" type="button">Sign out</button>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
