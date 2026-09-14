"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { EQUIPMENT_UNITS } from "@/lib/equipmentUnits";

// Generates a QR label per unit in lib/equipmentUnits.js, encoding this
// deployment's own origin (window.location.origin) so labels always point
// at wherever the app is actually running - no domain hardcoded here.
// Print, cut along the border, and stick one on each physical unit.
export default function PrintEquipmentLabelsPage() {
  const [labels, setLabels] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const origin = window.location.origin;
    Promise.all(
      EQUIPMENT_UNITS.map(async (u) => {
        const url = `${origin}/equipment-log/${u.id}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 260, margin: 1 });
        return { ...u, url, dataUrl };
      })
    )
      .then(setLabels)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="admin-card">
      <style>{`
        @media print {
          .app-sidebar, .app-header, .no-print { display: none !important; }
          .app-main, .app-content { padding: 0 !important; margin: 0 !important; }
          .label-grid { gap: 0 !important; }
        }
        .label-card {
          border: 1px dashed #999;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          break-inside: avoid;
        }
      `}</style>

      <h3 style={{ marginBottom: 4 }}>Print QR Labels</h3>
      <p className="helper-text no-print" style={{ marginBottom: 16 }}>
        One label per unit in lib/equipmentUnits.js. Edit that file to add, rename, or remove equipment, then reprint.
      </p>

      <button className="btn-small no-print" style={{ marginBottom: 20 }} onClick={() => window.print()}>
        Print
      </button>

      {error && <p className="error-text">{error}</p>}

      <div
        className="label-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}
      >
        {labels.map((l) => (
          <div key={l.id} className="label-card">
            <img src={l.dataUrl} alt={l.name} style={{ width: "100%", maxWidth: 180 }} />
            <div style={{ fontWeight: 700, marginTop: 6 }}>{l.name}</div>
            <div className="helper-text" style={{ marginTop: 0, fontSize: "0.72rem", wordBreak: "break-all" }}>
              {l.url}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
