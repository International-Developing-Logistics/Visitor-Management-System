"use client";

import { useEffect, useState } from "react";
import StepProgress from "@/components/StepProgress";
import VisitorDetailsForm from "@/components/VisitorDetailsForm";
import PhotoCapture from "@/components/PhotoCapture";
import SignaturePad from "@/components/SignaturePad";

const STEPS = ["Details", "Photo", "Signature", "Done"];

export default function WalkinPage() {
  const [step, setStep] = useState(0);
  const [hosts, setHosts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    purpose: "",
    purpose_detail: "",
    host_id: "",
    notes: "",
  });
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);

  useEffect(() => {
    fetch("/api/hosts")
      .then((r) => r.json())
      .then((d) => setHosts(d.hosts || []))
      .catch(() => setHosts([]));
  }, []);

  const submit = async (signatureDataUrl) => {
    setSubmitting(true);
    setSubmitError("");
    const finalPurpose =
      values.purpose === "Other" && values.purpose_detail
        ? `Other: ${values.purpose_detail}`
        : values.purpose;
    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          purpose: finalPurpose,
          photo,
          signature: signatureDataUrl,
          visit_type: "walkin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSignature(signatureDataUrl);
      setStep(3);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <div className="brand">Reception<span className="dot">·</span>Check-in</div>
      </div>

      <StepProgress steps={STEPS} currentIndex={step} />

      <div className="card">
        {step === 0 && (
          <VisitorDetailsForm
            hosts={hosts}
            values={values}
            onChange={setValues}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <div>
            <h3>Take your photo</h3>
            <PhotoCapture capturedPhoto={photo} onCapture={setPhoto} />
            {photo && (
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Continue
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Sign the visitor NDA</h3>
            {submitting ? (
              <p className="helper-text">Submitting…</p>
            ) : (
              <SignaturePad signed={null} onSign={submit} />
            )}
            {submitError && <p className="error-text">{submitError}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>You're checked in</h2>
            <p style={{ color: "var(--muted)" }}>
              Your host has been informed and will be with you soon.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
