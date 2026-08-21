"use client";

import { useEffect, useState } from "react";
import StepProgress from "@/components/StepProgress";
import VisitorDetailsForm from "@/components/VisitorDetailsForm";
import AgreementStep from "@/components/AgreementStep";
import BrandHeader from "@/components/BrandHeader";

const STEPS = ["Details", "Agreement", "Done"];

export default function WalkinForm({ facility }) {
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
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
  });

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
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          purpose: finalPurpose,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
          agreed: true,
          visit_type: "walkin",
          facility: facility.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStep(2);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
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
            <h3>Agree to the visitor terms</h3>
            <AgreementStep onAgree={submit} submitting={submitting} />
            {submitError && <p className="error-text">{submitError}</p>}
          </div>
        )}

        {step === 2 && (
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
