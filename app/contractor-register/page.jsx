"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import HyperlinkCopier from "@/components/HyperlinkCopier";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const DOCUMENT_OPTIONS = [
  {
    value: "freezone_pass",
    label: "Freezone gate pass",
    description: "Upload a copy of your existing Freezone gate pass.",
  },
  {
    value: "passport_emirates_id",
    label: "Passport + Emirates ID",
    description: "Upload copies of both your passport and your Emirates ID.",
  },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// One labeled file input, used for all three document slots below. Keeps
// the "wrong type / too large / unreadable" handling in one place instead
// of copy-pasted per document.
function DocumentUpload({ id, label, file, onChange }) {
  const [fileError, setFileError] = useState("");

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    setFileError("");
    if (!picked) {
      onChange(null, null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setFileError("Please upload a JPG, PNG, or PDF file.");
      onChange(null, null);
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFileError("The file is too large - please keep it under 3MB.");
      onChange(null, null);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(picked);
      onChange(picked, dataUrl);
    } catch {
      setFileError("File unreadable - please try again.");
      onChange(null, null);
    }
  };

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="file" accept={ACCEPTED_TYPES.join(",")} onChange={handleFile} />
      {file && !fileError && <p className="helper-text" style={{ marginTop: 6 }}>Selected: {file.name}</p>}
      {fileError && <p className="error-text">{fileError}</p>}
    </div>
  );
}

export default function ContractorRegisterPage() {
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    resident_id: "",
    company: "",
    estimated_duration: "",
  });
  const [documentType, setDocumentType] = useState(null);
  const [freezonePass, setFreezonePass] = useState({ file: null, dataUrl: null });
  const [passport, setPassport] = useState({ file: null, dataUrl: null });
  const [emiratesId, setEmiratesId] = useState({ file: null, dataUrl: null });
  const [result, setResult] = useState(null); // { passUrl }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const documentsComplete =
    documentType === "freezone_pass"
      ? !!freezonePass.dataUrl
      : documentType === "passport_emirates_id"
      ? !!passport.dataUrl && !!emiratesId.dataUrl
      : false;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          document_type: documentType,
          freezone_pass: freezonePass.dataUrl,
          passport: passport.dataUrl,
          emirates_id: emiratesId.dataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Contractor registration" />
      </div>

      <div className="card">
        {result ? (
          <div>
            <div className="confirm-wrap" style={{ paddingBottom: 8 }}>
              <div className="confirm-icon">✓</div>
              <h2>Registration received</h2>
              <p className="helper-text" style={{ marginBottom: 20 }}>
                An admin will review your registration and documents - we'll email you once a decision is made.
                Save this link to use your pass once approved:
              </p>
            </div>
            <HyperlinkCopier url={result.passUrl} defaultText="My contractor pass" />
          </div>
        ) : (
          <div>
            <h3>Contractor registration</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              For contractors/vendors that require a multi-entry pass.
            </p>

            <label htmlFor="cr-full-name">Full name</label>
            <input id="cr-full-name" type="text" value={values.full_name} onChange={set("full_name")} placeholder="Enter your full name" />

            <label htmlFor="cr-email">Email</label>
            <input id="cr-email" type="email" value={values.email} onChange={set("email")} placeholder="Enter your email address" />

            <label htmlFor="cr-resident-id">Resident ID</label>
            <input id="cr-resident-id" type="text" value={values.resident_id} onChange={set("resident_id")} placeholder="Enter your resident ID number" />

            <label htmlFor="cr-company">Company</label>
            <input id="cr-company" type="text" value={values.company} onChange={set("company")} placeholder="Enter your company name" />

            <label htmlFor="cr-duration">Estimated duration of access needed</label>
            <input
              id="cr-duration"
              type="text"
              value={values.estimated_duration}
              onChange={set("estimated_duration")}
              placeholder="eg. 3 months"
            />

            <label style={{ display: "block", marginTop: 14 }}>Identity documents</label>
            <p className="helper-text" style={{ marginTop: 0, marginBottom: 10 }}>
              Choose one of the two options below and upload the document(s) it requires.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
              {DOCUMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  htmlFor={`cr-doc-${opt.value}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    border: `1px solid ${documentType === opt.value ? "var(--accent-dark)" : "var(--line)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: documentType === opt.value ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <input
                    id={`cr-doc-${opt.value}`}
                    type="radio"
                    name="document_type"
                    value={opt.value}
                    checked={documentType === opt.value}
                    onChange={() => setDocumentType(opt.value)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: "block", fontWeight: 600 }}>{opt.label}</span>
                    <span className="helper-text" style={{ marginTop: 2, display: "block" }}>{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {documentType === "freezone_pass" && (
              <div style={{ marginTop: 10 }}>
                <DocumentUpload
                  id="cr-freezone-pass"
                  label="Freezone gate pass"
                  file={freezonePass.file}
                  onChange={(file, dataUrl) => setFreezonePass({ file, dataUrl })}
                />
              </div>
            )}

            {documentType === "passport_emirates_id" && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                <DocumentUpload
                  id="cr-passport"
                  label="Passport"
                  file={passport.file}
                  onChange={(file, dataUrl) => setPassport({ file, dataUrl })}
                />
                <DocumentUpload
                  id="cr-emirates-id"
                  label="Emirates ID"
                  file={emiratesId.file}
                  onChange={(file, dataUrl) => setEmiratesId({ file, dataUrl })}
                />
              </div>
            )}

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={
                submitting ||
                !values.full_name.trim() ||
                !values.email.trim() ||
                !documentType ||
                !documentsComplete
              }
            >
              {submitting ? "Submitting…" : "Register"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
