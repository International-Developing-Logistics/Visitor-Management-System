"use client";

import { useState } from "react";

export default function ImageOptionGrid({ items, selected, onChange, multi = false, unavailable = {} }) {
  const [blockedMessage, setBlockedMessage] = useState("");

  const isSelected = (name) => (multi ? selected.includes(name) : selected === name);

  const handleClick = (name) => {
    if (unavailable[name]) {
      setBlockedMessage(unavailable[name]);
      return;
    }
    setBlockedMessage("");

    if (multi) {
      if (selected.includes(name)) {
        onChange(selected.filter((s) => s !== name));
      } else {
        onChange([...selected, name]);
      }
    } else {
      onChange(name);
    }
  };

  const groups = [];
  const groupIndex = {};
  for (const item of items) {
    const key = item.category || "";
    if (!(key in groupIndex)) {
      groupIndex[key] = groups.length;
      groups.push({ category: key, items: [] });
    }
    groups[groupIndex[key]].items.push(item);
  }

  const renderButton = (item) => {
    const disabled = !!unavailable[item.name];
    const active = isSelected(item.name);
    return (
      <button
        type="button"
        key={item.name}
        onClick={() => handleClick(item.name)}
        aria-pressed={active}
        aria-disabled={disabled}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: 10,
          borderRadius: 10,
          border: `2px solid ${active ? "var(--accent)" : "var(--line)"}`,
          background: active ? "var(--accent-soft)" : disabled ? "var(--paper)" : "var(--card)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          position: "relative",
        }}
      >
        <img
          src={item.image}
          alt=""
          style={{ width: "100%", height: 70, objectFit: "contain", filter: disabled ? "grayscale(1)" : "none" }}
        />
        <span style={{ fontSize: "0.82rem", fontWeight: active ? 600 : 500, color: "var(--ink)", textAlign: "center" }}>
          {item.name}
        </span>
        {item.subtitle && (
          <span style={{ fontSize: "0.72rem", color: "var(--muted)", textAlign: "center" }}>{item.subtitle}</span>
        )}
        {disabled && (
          <span style={{ fontSize: "0.7rem", color: "var(--danger)", textAlign: "center" }}>In use</span>
        )}
        {active && !disabled && (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "white",
              fontSize: "0.7rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✓
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      {groups.map((group, i) => (
        <div key={group.category || `group-${i}`} style={{ marginBottom: i < groups.length - 1 ? 14 : 0 }}>
          {group.category && (
            <p
              className="helper-text"
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontWeight: 600,
                textTransform: "uppercase",
                fontSize: "0.72rem",
                letterSpacing: "0.03em",
              }}
            >
              {group.category}
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {group.items.map(renderButton)}
          </div>
        </div>
      ))}
      {blockedMessage && <p className="error-text" style={{ marginTop: 8 }}>{blockedMessage}</p>}
    </div>
  );
}
