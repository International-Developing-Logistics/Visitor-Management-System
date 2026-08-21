"use client";

import { COMPANY_TIMEZONE_LABEL } from "@/lib/timezone";

// value: { from: "YYYY-MM-DDTHH:mm" or "", until: "YYYY-MM-DDTHH:mm" or "" }
// (naive local values — converted to UTC by the caller at submit time via
// companyLocalToUtcIso, same pattern as the rest of the app's time inputs)
export default function TimeBlockPicker({ value, onChange, idPrefix }) {
  const invalidRange = value.from && value.until && new Date(value.until) <= new Date(value.from);

  return (
    <div>
      <div className="row-2">
        <div>
          <label htmlFor={`${idPrefix}-from`}>Needed from</label>
          <input
            id={`${idPrefix}-from`}
            type="datetime-local"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-until`}>Needed until</label>
          <input
            id={`${idPrefix}-until`}
            type="datetime-local"
            value={value.until}
            onChange={(e) => onChange({ ...value, until: e.target.value })}
          />
        </div>
      </div>
      <p className="helper-text" style={{ marginTop: 6 }}>
        Times are in {COMPANY_TIMEZONE_LABEL}.
      </p>
      {invalidRange && <p className="error-text">"Needed until" must be after "Needed from".</p>}
    </div>
  );
}
