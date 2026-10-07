"use client";

import { useMemo, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import BrandHeader from "@/components/BrandHeader";
import SignaturePad from "@/components/SignaturePad";
import { authFetch } from "@/lib/apiFetch";

// Security/gate function - same access tier as Gate Operations and the
// Security Log (requireAdminOrGuard server-side). Module-level constant
// so AdminGuard's effect doesn't re-run every render (see its own
// comments).
const ALLOWED_ROLES = ["admin", "guard"];

const YN = ["Yes", "No"];
const YNN = ["Yes", "No", "N/A"];
const OK = ["OK", "Not OK"];
const MT = ["Match", "Tampered"];

const T = (key, label, opts = {}) => ({ key, label, type: "text", ...opts });
const TEL = (key, label) => ({ key, label, type: "tel" });
const NUM = (key, label) => ({ key, label, type: "number" });
const DATE = (key, label) => ({ key, label, type: "date" });
const TIME = (key, label) => ({ key, label, type: "time" });
const SEL = (key, label, options) => ({ key, label, type: "select", options });
const AREA = (key, label) => ({ key, label, type: "textarea" });

// Mirrors the 11 sections of the original paper form (see
// Container_Gate_Check_Form.html). Every field's key becomes a key in the
// `fields` jsonb column - the admin list/detail view reads the same keys.
export const SECTIONS = [
  ["Arrival & Gate", [
    DATE("date", "Date"), TIME("timeIn", "Time In"), TIME("timeOut", "Time Out"),
    T("gateNo", "Gate No."), SEL("shift", "Shift", ["Day", "Night"]), T("securityOfficer", "Security Officer"),
    SEL("movement", "Movement", ["Import", "Export", "Transfer"]), SEL("containerStatus", "Container Status", ["Full", "Empty"]),
    T("bookingRef", "Booking / Appt. Ref."),
  ]],
  ["Company Details", [
    T("transportCompany", "Transport Company"), T("transporterLicence", "Transporter Licence No."), T("consignee", "Consignee / Customer"),
    T("shipper", "Shipper"), T("clearingAgent", "Clearing Agent"), T("shippingLine", "Shipping Line"),
    T("contactPerson", "Contact Person"), TEL("contactPhone", "Contact Phone"), SEL("preAdvised", "Pre-advised?", YN),
  ]],
  ["Driver Details", [
    T("driverName", "Driver Name", { required: true }), T("nationality", "Nationality"), TEL("mobile", "Mobile No."),
    T("driverIdNo", "Emirates ID / Passport"), DATE("idExpiry", "ID Expiry"), T("gatePassNo", "Gate Pass / Card No."),
    T("licenceNo", "Licence No."), DATE("licenceExpiry", "Licence Expiry"), SEL("ppe", "PPE Worn", YN),
    T("helperName", "Helper Name"), T("helperId", "Helper ID No."), SEL("fitness", "Fitness Concern", YN),
  ]],
  ["Truck & Trailer Details", [
    T("truckPlate", "Truck Plate No.", { mono: true, required: true }), T("truckEmirate", "Emirate / Code"), T("truckMake", "Make / Model / Colour"),
    T("trailerPlate", "Trailer Plate No.", { mono: true }), SEL("trailerType", "Trailer Type", ["Flat", "Skel", "Low"]), DATE("mulkiyaExpiry", "Mulkiya Expiry"),
  ]],
  ["Accompanying / Escort Car (if any)", [
    T("carPlate", "Car Plate No.", { mono: true }), T("carEmirate", "Emirate / Code"), T("carMake", "Make / Model / Colour"),
    T("carDriver", "Car Driver Name"), T("carDriverId", "Driver ID No."), T("carOccupants", "Occupants / Purpose"),
  ]],
  ["Container Details", [
    T("containerNo", "Container No.", { mono: true, placeholder: "ABCU1234567", required: true }), SEL("size", "Size", ["20'", "40'", "45'"]), SEL("ctype", "Type", ["GP", "HC", "RF", "OT", "FR"]),
    T("blNo", "B/L No.", { mono: true }), T("doNo", "Delivery Order No.", { mono: true }), T("cargo", "Cargo Description"),
    NUM("grossWeight", "Gross Weight (kg)"), T("reefer", "Reefer Set / Actual °C"), SEL("dg", "Dangerous Goods", YN),
    T("imo", "IMO Class / UN No.", { mono: true }), SEL("dgPlacards", "DG Placards", YN), SEL("checkDigit", "Check Digit OK", YN),
  ]],
  ["Shipping Line Seal Details", [
    T("seal1", "Seal No. 1 (on box)", { mono: true }), T("seal1Docs", "Seal No. on Docs", { mono: true }), SEL("seal1Cond", "Match / Condition", MT),
    T("seal2", "Seal No. 2 (on box)", { mono: true }), T("seal2Docs", "Seal No. on Docs", { mono: true }), SEL("seal2Cond", "Match / Condition", MT),
  ]],
  ["Customs Seal Details", [
    T("customsSeal", "Customs Seal No.", { mono: true }), T("customsSealDocs", "Seal No. on Docs", { mono: true }), SEL("customsSealCond", "Match / Condition", MT),
    T("boeNo", "Declaration / BOE No.", { mono: true }), T("eseal", "E-Seal / GPS No.", { mono: true }), T("customsOfficer", "Customs Officer / ID"),
  ]],
  ["Container Inspection", [
    SEL("frontWall", "Front wall", OK), SEL("leftWall", "Left side wall", OK), SEL("rightWall", "Right side wall", OK),
    SEL("floor", "Floor", OK), SEL("ceiling", "Ceiling / Roof", OK), SEL("doors", "Doors, locks, hinges", OK),
    SEL("undercarriage", "Undercarriage", OK), SEL("tampering", "Tampering / repairs", OK), SEL("holes", "Holes, dents, rust", OK),
    SEL("leaks", "Leaks / odour", OK), NUM("photoQty", "Photos taken (qty)"), T("cctv", "CCTV time ref."),
  ]],
  ["Documents Verified", [
    SEL("docDO", "Delivery Order", YNN), SEL("docBL", "Bill of Lading", YNN), SEL("docBOE", "Customs Decl. / BOE", YNN),
    SEL("docInvoice", "Invoice / Packing List", YNN), SEL("docEIR", "EIR", YNN), SEL("docGatePass", "Gate Pass / Permit", YNN),
    SEL("docDG", "DG Declaration / MSDS", YNN), SEL("docTrip", "Trip Sheet / Work Order", YNN), T("docOther", "Other"),
  ]],
  ["Discrepancies & Action", [
    SEL("discrepancy", "Discrepancy Found", YN), T("reportedTo", "Reported To / Time"), { ...SEL("decision", "Decision", ["Accept", "Hold", "Reject"]), required: true },
    AREA("remarks", "Remarks"),
  ]],
];

export const SIGN_ROLES = [
  ["officer", "Security Officer", true],
  ["supervisor", "Security Supervisor", false],
  ["driver", "Driver", true],
  ["receiver", "Warehouse Receiver", false],
];

export const PHOTO_SLOTS = [
  ["containerSealed", "Container Sealed"],
  ["customsSealed", "Customs Sealed"],
  ["containerDoor", "Container Door"],
  ["goodsReceiving", "Goods Receiving"],
  ["containerClosing", "Container Closing"],
  ["driverDetails", "Driver Details", "Driver ID, Freezone pass, driver company"],
  ["truckDetails", "Truck Details", "Licence plate"],
];

// ---------- ISO 6346 container check-digit validator (ported from the
// original form - ten-letter-and-digit sequence, weighted mod-11-mod-10) ----------
const LETTER_VALUES = {};
(() => {
  let v = 10;
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (v % 11 === 0) v++;
    LETTER_VALUES[ch] = v++;
  }
})();
function checkContainerNo(raw) {
  const s = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  if (!/^[A-Z]{4}\d{7}$/.test(s)) return { ok: false, text: "Format: 4 letters + 7 digits" };
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = s[i];
    sum += (LETTER_VALUES[ch] ?? Number(ch)) * Math.pow(2, i);
  }
  const digit = (sum % 11) % 10;
  const ok = digit === Number(s[10]);
  return { ok, text: ok ? `Check digit ${digit} valid` : `Check digit should be ${digit}` };
}

// ---------- minimal EXIF reader (date + GPS only), ported from the
// original form's client-side JS - operates on a JPEG's raw bytes ----------
function readExif(buf) {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return {};
    let o = 2;
    while (o < v.byteLength - 10) {
      const m = v.getUint16(o);
      if ((m & 0xff00) !== 0xff00) break;
      if (m === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
      if (m === 0xffda) break;
      o += 2 + v.getUint16(o + 2);
    }
  } catch (e) {
    // not a JPEG with EXIF, or malformed - fall through to {}
  }
  return {};
}
function parseTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const g16 = (p) => v.getUint16(p, le);
  const g32 = (p) => v.getUint32(p, le);
  const tags = (off) => {
    const n = g16(off), m = {};
    for (let i = 0; i < n; i++) m[g16(off + 2 + i * 12)] = off + 2 + i * 12;
    return m;
  };
  const ascii = (e) => {
    const c = g32(e + 4), p = c > 4 ? t + g32(e + 8) : e + 8;
    let s = "";
    for (let i = 0; i < c - 1; i++) s += String.fromCharCode(v.getUint8(p + i));
    return s;
  };
  const rats = (e) => {
    const c = g32(e + 4), p = t + g32(e + 8), a = [];
    for (let i = 0; i < c; i++) a.push(g32(p + i * 8) / g32(p + i * 8 + 4));
    return a;
  };
  const out = {};
  const i0 = tags(t + g32(t + 4));
  let ds = null;
  if (i0[0x8769]) {
    const ex = tags(t + g32(i0[0x8769] + 8));
    const e = ex[0x9003] || ex[0x9004];
    if (e) ds = ascii(e);
  }
  if (!ds && i0[0x0132]) ds = ascii(i0[0x0132]);
  const dm = ds && ds.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
  if (dm && dm[1] !== "0000") out.date = `${dm[1]}-${dm[2]}-${dm[3]}T${dm[4]}:${dm[5]}:${dm[6]}`;
  if (i0[0x8825]) {
    const g = tags(t + g32(i0[0x8825] + 8));
    if (g[2] && g[4]) {
      const la = rats(g[2]), lo = rats(g[4]);
      let lat = la[0] + (la[1] || 0) / 60 + (la[2] || 0) / 3600;
      let lng = lo[0] + (lo[1] || 0) / 60 + (lo[2] || 0) / 3600;
      const ref = (e) => (e ? String.fromCharCode(v.getUint8(e + 8)) : "");
      if (ref(g[1]) === "S") lat = -lat;
      if (ref(g[3]) === "W") lng = -lng;
      if (isFinite(lat) && isFinite(lng) && (lat || lng)) out.gps = { lat, lng, source: "photo" };
    }
  }
  return out;
}
function deviceGps() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, source: "device" });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });
}
async function shrinkImageFile(file, maxDim = 1600, quality = 0.8) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  const k = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/jpeg", quality), width: canvas.width, height: canvas.height };
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function autoFormNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `GC-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
function fmtLocal(iso) {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : iso;
}
function fmtGps(g) {
  if (!g) return "Not available";
  return `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)} (${g.source})`;
}

function Field({ field, value, onChange }) {
  const id = `gcf_${field.key}`;
  const common = { id, value: value ?? "" };

  if (field.type === "select") {
    return (
      <div>
        <label htmlFor={id}>{field.label}{field.required && " *"}</label>
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div style={{ gridColumn: "1 / -1" }}>
        <label htmlFor={id}>{field.label}</label>
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id}>{field.label}{field.required && " *"}</label>
      <input
        {...common}
        type={field.type}
        placeholder={field.placeholder}
        style={field.mono ? { fontFamily: "monospace", textTransform: "uppercase" } : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.key === "containerNo" && value && (() => {
        const r = checkContainerNo(value);
        return r && <p className={r.ok ? "helper-text" : "error-text"} style={{ marginTop: 4 }}>{r.text}</p>;
      })()}
    </div>
  );
}

function PhotoSlot({ slot, photo, onAdd, onRemove }) {
  const [code, label, sub] = slot;
  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    await onAdd(code, file);
  };
  return (
    <div className="card" style={{ padding: 14, margin: 0 }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>{label}</p>
      {sub && <p className="helper-text" style={{ marginTop: 2 }}>{sub}</p>}
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "var(--paper)",
          border: "1px dashed var(--line)",
          borderRadius: 8,
          margin: "8px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photo ? (
          <img src={photo.data} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span className="helper-text" style={{ margin: 0 }}>No photo yet</span>
        )}
      </div>
      {photo && (
        <p className="helper-text" style={{ marginTop: 0 }}>
          Taken {fmtLocal(photo.takenAt)} ({photo.takenSource}) · GPS {fmtGps(photo.gps)}
        </p>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <label className="btn-small" style={{ cursor: "pointer" }}>
          Camera
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={pick} />
        </label>
        <label className="btn-small" style={{ cursor: "pointer" }}>
          {photo ? "Replace" : "Upload"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={pick} />
        </label>
        {photo && (
          <button type="button" className="btn-small" onClick={() => onRemove(code)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function GateCheckForm({ facility }) {
  const [fields, setFields] = useState({ date: today() });
  const [signatures, setSignatures] = useState({});
  const [stamp, setStamp] = useState(null);
  const [photos, setPhotos] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const setField = (key, value) => setFields((f) => ({ ...f, [key]: value }));

  const addPhoto = async (code, file) => {
    try {
      const exif = readExif(await file.arrayBuffer());
      const img = await shrinkImageFile(file);
      const gps = exif.gps || (await deviceGps());
      setPhotos((p) => ({
        ...p,
        [code]: {
          data: img.data,
          width: img.width,
          height: img.height,
          origName: file.name,
          takenAt: exif.date || new Date(file.lastModified || Date.now()).toISOString().slice(0, 16),
          takenSource: exif.date ? "photo" : "file time",
          gps: gps || null,
          addedAt: new Date().toISOString(),
        },
      }));
    } catch (e) {
      setError("That photo could not be read. Try a JPG or PNG.");
    }
  };
  const removePhoto = (code) => setPhotos((p) => { const n = { ...p }; delete n[code]; return n; });

  const onStampFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await shrinkImageFile(file, 400, 0.85);
      setStamp(img.data);
    } catch (e2) {
      setError("That stamp photo could not be read.");
    }
  };

  const missing = useMemo(() => {
    const problems = [];
    SECTIONS.forEach(([, flds]) =>
      flds.forEach((f) => {
        if (f.required && !(fields[f.key] || "").trim()) problems.push(f.label);
      })
    );
    SIGN_ROLES.forEach(([role, label, required]) => {
      if (required && !signatures[role]) problems.push(`${label} signature`);
    });
    return problems;
  }, [fields, signatures]);

  const submit = async () => {
    if (missing.length) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formNo = (fields.formNo || "").trim() || autoFormNo();
      const signatureBlock = {};
      SIGN_ROLES.forEach(([role]) => {
        if (signatures[role] || fields[`sign${role[0].toUpperCase()}${role.slice(1)}Name`] || fields[`sign${role[0].toUpperCase()}${role.slice(1)}Time`]) {
          signatureBlock[role] = {
            name: fields[`sign${role[0].toUpperCase()}${role.slice(1)}Name`] || "",
            time: fields[`sign${role[0].toUpperCase()}${role.slice(1)}Time`] || "",
            signature: signatures[role] || null,
          };
        }
      });
      if (fields.receiptAck || signatures.receipt || fields.receiptName) {
        signatureBlock.receipt = {
          name: fields.receiptName || "",
          acknowledged: !!fields.receiptAck,
          signature: signatures.receipt || null,
        };
      }
      const photoList = PHOTO_SLOTS.map(([code, label]) => {
        const p = photos[code];
        return p
          ? { field: code, label, takenAt: p.takenAt, takenSource: p.takenSource, gps: p.gps, originalName: p.origName, image: p.data }
          : { field: code, label, status: "not_captured" };
      });

      const res = await authFetch("/api/gate-check-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility: facility.key,
          form_no: formNo,
          fields,
          signatures: signatureBlock,
          stamp_photo: stamp,
          photos: photoList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSubmitted(formNo);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFields({ date: today() });
    setSignatures({});
    setStamp(null);
    setPhotos({});
    setSubmitted(null);
    setError("");
  };

  const photoCount = Object.keys(photos).length;

  return (
    <AdminGuard allowedRoles={ALLOWED_ROLES}>
      <main className="kiosk-shell" style={{ alignItems: "center" }}>
        <div className="kiosk-header" style={{ maxWidth: 960 }}>
          <BrandHeader label="Gate Check" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
        </div>

        <div className="card" style={{ maxWidth: 960 }}>
          {submitted ? (
            <div className="confirm-wrap">
              <div className="confirm-icon">✓</div>
              <h2>Gate check form submitted</h2>
              <p className="helper-text">Form No. {submitted} has been saved.</p>
              <button className="btn btn-secondary" onClick={reset}>Start another</button>
            </div>
          ) : (
            <div>
              <h3 style={{ marginBottom: 4 }}>Container Receiving – Security Gate Check Form</h3>
              <p className="helper-text" style={{ marginBottom: 16 }}>
                {facility.label} · Fields marked * are required.
              </p>

              <label htmlFor="gcf_formNo">Form No.</label>
              <input id="gcf_formNo" value={fields.formNo || ""} placeholder="Assigned on submit" onChange={(e) => setField("formNo", e.target.value)} />

              {SECTIONS.map(([title, flds], i) => (
                <section key={title} style={{ marginTop: 24 }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                    {String(i + 1).padStart(2, "0")} · {title}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                    {flds.map((f) => (
                      <Field key={f.key} field={f} value={fields[f.key]} onChange={(v) => setField(f.key, v)} />
                    ))}
                  </div>
                </section>
              ))}

              <section style={{ marginTop: 24 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                  12 · Sign-off
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                  {SIGN_ROLES.map(([role, label, required]) => {
                    const cap = role[0].toUpperCase() + role.slice(1);
                    return (
                      <div key={role} className="card" style={{ padding: 14, margin: 0 }}>
                        <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9rem" }}>{label}{required && " *"}</p>
                        <input
                          placeholder="Name"
                          value={fields[`sign${cap}Name`] || ""}
                          onChange={(e) => setField(`sign${cap}Name`, e.target.value)}
                          style={{ marginBottom: 8 }}
                        />
                        <SignaturePad value={signatures[role] || null} onChange={(v) => setSignatures((s) => ({ ...s, [role]: v }))} height={80} />
                        <input
                          type="datetime-local"
                          value={fields[`sign${cap}Time`] || ""}
                          onChange={(e) => setField(`sign${cap}Time`, e.target.value)}
                          style={{ marginTop: 8 }}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="helper-text" style={{ marginTop: 10 }}>
                  Driver confirms the container, seals and documents were inspected in his presence.
                </p>

                <label style={{ marginTop: 16 }}>Company Stamp</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {stamp ? (
                    <img src={stamp} alt="Company stamp" style={{ height: 80, borderRadius: 6, border: "1px solid var(--line)" }} />
                  ) : (
                    <span className="helper-text" style={{ margin: 0 }}>No stamp photo yet</span>
                  )}
                  <label className="btn-small" style={{ cursor: "pointer" }}>
                    {stamp ? "Replace" : "Add photo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={onStampFile} />
                  </label>
                  {stamp && (
                    <button type="button" className="btn-small" onClick={() => setStamp(null)}>Remove</button>
                  )}
                </div>
              </section>

              <section style={{ marginTop: 24 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>
                  13 · Receiving Evidence &amp; Photo Appendix (optional)
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
                  <div>
                    <label htmlFor="gcf_rcvLocation">Receiving Location</label>
                    <input id="gcf_rcvLocation" value={fields.rcvLocation || ""} onChange={(e) => setField("rcvLocation", e.target.value)} placeholder="e.g. DWC Warehouse 3, Bay 12" />
                  </div>
                  <div>
                    <label htmlFor="gcf_rcvTime">Receiving Date / Time</label>
                    <input id="gcf_rcvTime" type="datetime-local" value={fields.rcvTime || ""} onChange={(e) => setField("rcvTime", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="gcf_shipmentRef">P.O. / Shipment Ref.</label>
                    <input id="gcf_shipmentRef" value={fields.shipmentRef || ""} onChange={(e) => setField("shipmentRef", e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="gcf_carrierName">Carrier Name</label>
                    <input id="gcf_carrierName" value={fields.carrierName || ""} onChange={(e) => setField("carrierName", e.target.value)} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="gcf_conditionNotes">Condition Notes on Arrival</label>
                    <textarea id="gcf_conditionNotes" rows={3} value={fields.conditionNotes || ""} onChange={(e) => setField("conditionNotes", e.target.value)} placeholder="Optional: damage, wet cartons, shortages, temperature, odour…" />
                  </div>
                </div>

                <div className="card" style={{ margin: "14px 0", padding: 14 }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9rem" }}>Receipt Acknowledgment</p>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 400, fontSize: "0.85rem", color: "var(--ink)", margin: "0 0 10px" }}>
                    <input type="checkbox" checked={!!fields.receiptAck} onChange={(e) => setField("receiptAck", e.target.checked)} style={{ width: "auto", marginTop: 2 }} />
                    Goods received as described in this form, subject to the condition notes above.
                  </label>
                  <input placeholder="Received by (name)" value={fields.receiptName || ""} onChange={(e) => setField("receiptName", e.target.value)} style={{ marginBottom: 8 }} />
                  <SignaturePad value={signatures.receipt || null} onChange={(v) => setSignatures((s) => ({ ...s, receipt: v }))} height={70} />
                </div>

                <p className="helper-text" style={{ marginBottom: 8 }}>Photo captures: {photoCount} of {PHOTO_SLOTS.length} attached</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {PHOTO_SLOTS.map((slot) => (
                    <PhotoSlot key={slot[0]} slot={slot} photo={photos[slot[0]]} onAdd={addPhoto} onRemove={removePhoto} />
                  ))}
                </div>
              </section>

              {error && <p className="error-text" style={{ marginTop: 20 }}>{error}</p>}

              <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit gate check form"}
              </button>
            </div>
          )}
        </div>
      </main>
    </AdminGuard>
  );
}
