"use client";

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
        Optional — offer a few times and let your guest pick one when they complete their pre-registration.
      </p>
    </div>
  );
}
