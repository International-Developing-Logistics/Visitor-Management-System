"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import HyperlinkCopier from "@/components/HyperlinkCopier";
import { supabase } from "@/lib/supabaseClient";
import {
  CONTRACTOR_DOCS_BUCKET,
  MAX_DOCUMENT_BYTES as MAX_FILE_BYTES,
  ACCEPTED_DOCUMENT_TYPES as ACCEPTED_TYPES,
} from "@/lib/contractorDocuments";

// Parses an API response, tolerating non-JSON bodies (e.g. Vercel's plain
// text "Request Entity Too Large") so users see a readable message instead
// of "Unexpected token ... is not valid JSON".
async function readApiResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status}). Please try again.`);
  }
  if (!data) throw new Error("Unexpected response from the server. Please try again.");
  return data;
}

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

// One labeled file input, used for all three document slots below. Keeps
// the "wrong type / too large / unreadable" handling in one place instead
// of copy-pasted per document.
function DocumentUpload({ id, label, file, onChange }) {
  const [fileError, setFileError] = useState("");

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    setFileError("");
    if (!picked) {
      onChange(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setFileError("Please upload a JPG, PNG, or PDF file.");
      onChange(null);
      return;
    }
    if (picked.size === 0) {
      setFileError("File unreadable - please try again.");
      onChange(null);
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFileError("The file is too large - please keep it under 10MB.");
      onChange(null);
      return;
    }
    onChange(picked);
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
  const [freezonePass, setFreezonePass] = useState(null);
  const [passport, setPassport] = useState(null);
  const [emiratesId, setEmiratesId] = useState(null);
  const [result, setResult] = useState(null); // { passUrl }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const documentsComplete =
    documentType === "freezone_pass"
      ? !!freezonePass
      : documentType === "passport_emirates_id"
      ? !!passport && !!emiratesId
      : false;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const filesBySlot =
        documentType === "freezone_pass"
          ? { "freezone-pass": freezonePass }
          : { passport, "emirates-id": emiratesId };

      // 1. Get one-time signed upload links for each document.
      const prep = await readApiResponse(
        await fetch("/api/contractors/upload-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_type: documentType,
            files: Object.fromEntries(
              Object.entries(filesBySlot).map(([slot, f]) => [slot, { type: f.type, size: f.size }])
            ),
          }),
        })
      );

      // 2. Upload the files straight to storage (not through Vercel).
      await Promise.all(
        Object.entries(filesBySlot).map(async ([slot, f]) => {
          const { path, token } = prep.uploads[slot];
          const { error: upErr } = await supabase.storage
            .from(CONTRACTOR_DOCS_BUCKET)
            .uploadToSignedUrl(path, token, f, { contentType: f.type });
          if (upErr) throw new Error(`Upload failed - please try again. (${upErr.message})`);
        })
      );

      // 3. Submit the registration itself - small JSON, no file data.
      const data = await readApiResponse(
        await fetch("/api/contractors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, document_type: documentType, upload_id: prep.upload_id }),
        })
      );
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
                  file={freezonePass}
                  onChange={setFreezonePass}
                />
              </div>
            )}

            {documentType === "passport_emirates_id" && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                <DocumentUpload
                  id="cr-passport"
                  label="Passport"
                  file={passport}
                  onChange={setPassport}
                />
                <DocumentUpload
                  id="cr-emirates-id"
                  label="Emirates ID"
                  file={emiratesId}
                  onChange={setEmiratesId}
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
