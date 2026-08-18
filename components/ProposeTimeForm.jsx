"use client";

import { useState } from "react";
import { formatInCompanyTimezone, COMPANY_TIMEZONE_LABEL } from "@/lib/timezone";

// value: UTC ISO string or "". onChange receives a UTC ISO string or "".
// Unlike host-entered time slots, this input is the GUEST's own device, so
// their naive datetime-local value is correctly interpreted using their
// own browser's timezone — no special conversion needed, just a plain
// `new Date(...)`, which is exactly what happens here.
export default function ProposeTimeForm({ value, onChange, label = "Propose a different time" }) {
  const [open, setOpen] = useState(!!value);
  const [naiveValue, setNaiveValue] = useState("");

  const handleChange = (e) => {
    const naive = e.target.value;
    setNaiveValue(naive);
    if (!naive) {
      onChange("");
      return;
    }
    const d = new Date(naive);
    onChange(Number.isNaN(d.getTime()) ? "" : d.toISOString());
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent-dark)",
          textDecoration: "underline",
          cursor: "pointer",
          fontSize: "0.88rem",
          padding: 0,
          marginTop: 10,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label htmlFor="propose-time">Your preferred date and time</label>
      <input id="propose-time" type="datetime-local" value={naiveValue} onChange={handleChange} />
      {value && (
        <p className="helper-text" style={{ marginTop: 6 }}>
          Your host will see this as {formatInCompanyTimezone(value)} ({COMPANY_TIMEZONE_LABEL}).
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setNaiveValue("");
          onChange("");
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          textDecoration: "underline",
          cursor: "pointer",
          fontSize: "0.82rem",
          padding: 0,
          marginTop: 6,
        }}
      >
        Cancel
      </button>
    </div>
  );
}
