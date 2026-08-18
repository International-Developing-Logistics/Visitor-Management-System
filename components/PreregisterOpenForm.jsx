"use client";

import { useEffect, useState } from "react";
import StepProgress from "@/components/StepProgress";
import VisitorDetailsForm from "@/components/VisitorDetailsForm";
import ProposeTimeForm from "@/components/ProposeTimeForm";
import AgreementStep from "@/components/AgreementStep";
import BrandHeader from "@/components/BrandHeader";
import HyperlinkCopier from "@/components/HyperlinkCopier";

const STEPS = ["Details", "Time", "Agreement", "Done"];

// facility: { key, label, logo } from lib/facilities.js
export default function PreregisterOpenForm({ facility }) {
  const [step, setStep] = useState(0);
  const [hosts, setHosts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [checkinUrl, setCheckinUrl] = useState("");
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    purpose: "",
    purpose_detail: "",
    host_id: "",
    notes: "",
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
  });
  const [preferredTime, setPreferredTime] = useState("");

  useEffect(() => {
    fetch("/api/hosts")
      .then((r) => r.json())
      .then((d) => setHosts(d.hosts || []))
      .catch(() => setHosts([]));
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    const finalPurpose =
      values.purpose === "Other" && values.purpose_detail
        ? `Other: ${values.purpose_detail}`
        : values.purpose;
    try {
      const res = await fetch("/api/preregister-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          purpose: finalPurpose,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
          proposed_alternative_time: preferredTime || null,
          agreed: true,
          facility: facility.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setCheckinUrl(data.checkinUrl);
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
        <BrandHeader label="Pre-registration" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
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
            <h3>Preferred time (optional)</h3>
            <p className="helper-text" style={{ marginBottom: 4 }}>
              Let your host know when you'd like to visit - they'll confirm or suggest another time.
            </p>
            <ProposeTimeForm
              value={preferredTime}
              onChange={setPreferredTime}
              label="+ Add a preferred date and time"
            />
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Agree to the visitor terms</h3>
            <AgreementStep onAgree={submit} submitting={submitting} />
            {submitError && <p className="error-text">{submitError}</p>}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="confirm-wrap" style={{ paddingBottom: 8 }}>
              <div className="confirm-icon">✓</div>
              <h2>You're pre-registered</h2>
              <p className="helper-text" style={{ marginBottom: 20 }}>
                Your host has been notified. Save this link - open it when you arrive to check in:
              </p>
            </div>
            <HyperlinkCopier url={checkinUrl} defaultText="My check-in link" />
          </div>
        )}
      </div>
    </main>
  );
}
