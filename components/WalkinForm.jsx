"use client";

import { useEffect, useState } from "react";
import StepProgress from "@/components/StepProgress";
import VisitorDetailsForm from "@/components/VisitorDetailsForm";
import BrandHeader from "@/components/BrandHeader";
import { OTHER_VISITOR_TYPE } from "@/lib/visitorTypes";

// No separate "Agreement" step anymore — the visitor-terms notice is shown
// directly on the Details form (see VisitorDetailsForm's showAgreementNotice
// prop below), and clicking "Check-in" there is the acknowledgment.
const STEPS = ["Details", "Done"];

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
    visitor_type: "",
    visitor_type_detail: "",
    host_id: "",
    notes: "",
    is_group: false,
    additional_visitor_count: "",
    additional_visitor_names: "",
    group_members: [],
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
    // "Other" combines the picked type + the free-text detail into one
    // string before sending, e.g. "Other: Passport renewal" — same
    // convention already used for `purpose` on the request-invite/preregister
    // staff tools (see lib/visitorTypes.js).
    const finalVisitorType =
      values.visitor_type === OTHER_VISITOR_TYPE && values.visitor_type_detail
        ? `${OTHER_VISITOR_TYPE}: ${values.visitor_type_detail}`
        : values.visitor_type;
    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          visitor_type: finalVisitorType,
          additional_visitor_count: values.is_group ? values.additional_visitor_count : 0,
          additional_visitor_names: values.is_group ? values.additional_visitor_names : "",
          group_members: values.is_group ? values.group_members : [],
          agreed: true,
          visit_type: "walkin",
          facility: facility.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStep(1);
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
          <div>
            <VisitorDetailsForm
              hosts={hosts}
              values={values}
              onChange={setValues}
              onNext={submit}
              showAgreementNotice
              submitLabel="Check-in"
              busyLabel="Checking in…"
              submitting={submitting}
            />
            {submitError && <p className="error-text">{submitError}</p>}
          </div>
        )}

        {step === 1 && (
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
