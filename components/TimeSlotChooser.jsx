"use client";

import { formatInViewerLocalTime, formatInCompanyTimezone, COMPANY_TIMEZONE_LABEL } from "@/lib/timezone";

export default function TimeSlotChooser({ slots, value, onChange }) {
  if (!slots || slots.length === 0) return null;

  return (
    <div>
      <label>Choose a time</label>
      {slots.map((iso) => (
        <label
          key={iso}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            border: "1.5px solid var(--line)",
            borderRadius: 10,
            marginBottom: 8,
            cursor: "pointer",
            background: value === iso ? "var(--accent-soft)" : "var(--paper)",
            borderColor: value === iso ? "var(--accent)" : "var(--line)",
          }}
        >
          <input
            type="radio"
            name="time-slot"
            checked={value === iso}
            onChange={() => onChange(iso)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontWeight: 400, color: "var(--ink)" }}>
            {formatInViewerLocalTime(iso)}
            <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              {" "}({formatInCompanyTimezone(iso)} {COMPANY_TIMEZONE_LABEL})
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
