"use client";

import { COMPANY_TIMEZONE_LABEL } from "@/lib/timezone";

// slots: array of "YYYY-MM-DDTHH:mm" local datetime strings, entered as
// Dubai wall-clock time (converted to UTC by the caller before submitting
// — see companyLocalToUtcIso in lib/timezone.js).
export default function TimeSlotEditor({ slots, onChange }) {
  const updateSlot = (i, value) => {
    const next = [...slots];
    next[i] = value;
    onChange(next);
  };

  const addSlot = () => onChange([...slots, ""]);
  const removeSlot = (i) => onChange(slots.filter((_, idx) => idx !== i));

  return (
    <div>
      {slots.map((slot, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            type="datetime-local"
            value={slot}
            onChange={(e) => updateSlot(i, e.target.value)}
            aria-label={`Proposed time slot ${i + 1}`}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn-small"
            onClick={() => removeSlot(i)}
            style={{ flexShrink: 0 }}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-small" onClick={addSlot}>
        + Add time slot
      </button>
      <p className="helper-text" style={{ marginTop: 6 }}>
        Times are entered in {COMPANY_TIMEZONE_LABEL} — optional, offer a few and let your
        guest pick one when they complete their pre-registration.
      </p>
    </div>
  );
}
