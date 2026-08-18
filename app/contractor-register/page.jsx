"use client";

import { useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import HyperlinkCopier from "@/components/HyperlinkCopier";

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB — stays safely under Vercel's request size limit once base64-encoded

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ContractorRegisterPage() {
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    resident_id: "",
    company: "",
    estimated_duration: "",
  });
  const [passportFile, setPassportFile] = useState(null);
  const [passportDataUrl, setPassportDataUrl] = useState(null);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState(null); // { passUrl }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    setFileError("");
    setPassportFile(null);
    setPassportDataUrl(null);
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      setFileError("Please upload a JPG, PNG, or PDF file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("That file is too large — please keep it under 3MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPassportFile(file);
      setPassportDataUrl(dataUrl);
    } catch {
      setFileError("Couldn't read that file — please try again.");
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, passport: passportDataUrl }),
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
                An admin will review and activate your pass — we'll email you when it's ready.
                Save this link too, it's your pass once activated:
              </p>
            </div>
            <HyperlinkCopier url={result.passUrl} defaultText="My contractor pass" />
          </div>
        ) : (
          <div>
            <h3>Contractor registration</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              For contractors who'll be visiting regularly for a project.
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
              placeholder="e.g. 3 months, until March 2027"
            />

            <label htmlFor="cr-passport">Passport copy</label>
            <input id="cr-passport" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFile} />
            {passportFile && !fileError && (
              <p className="helper-text" style={{ marginTop: 6 }}>Selected: {passportFile.name}</p>
            )}
            {fileError && <p className="error-text">{fileError}</p>}

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={
                submitting ||
                !values.full_name.trim() ||
                !values.email.trim() ||
                !passportDataUrl
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
