"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PhotoCapture from "@/components/PhotoCapture";
import SignaturePad from "@/components/SignaturePad";

function CheckinInner() {
  const token = useSearchParams().get("token");
  const [loading, setLoading] = useState(true);
  const [visitor, setVisitor] = useState(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("details"); // details -> photo -> signature -> arrived
  const [values, setValues] = useState({ full_name: "", phone: "", company: "" });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This link is missing a token. Please use the link from your email.");
      setLoading(false);
      return;
    }
    fetch(`/api/checkin?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setVisitor(d.visitor);
        setValues({
          full_name: d.visitor.full_name || "",
          phone: d.visitor.phone || "",
          company: d.visitor.company || "",
        });
        if (d.visitor.status === "checked_in") setStage("arrived");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const completePreregistration = async (signatureDataUrl) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/preregister/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...values, photo, signature: signatureDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitor(data.visitor);
      setStage("ready"); // pre-registration done, not yet arrived
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmArrival = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVisitor(data.visitor);
      setStage("arrived");
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="helper-text">Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;

  // Visitor already completed pre-reg earlier and is now arriving.
  if (visitor?.status === "pre_registered" && stage !== "ready") {
    return (
      <div className="confirm-wrap">
        <h2>Welcome back, {visitor.full_name}</h2>
        <p className="helper-text" style={{ marginBottom: 24 }}>
          You're pre-registered to see {visitor.hosts?.name || "your host"}. Tap below to let them know you've arrived.
        </p>
        <button className="btn btn-primary" onClick={confirmArrival} disabled={submitting}>
          {submitting ? "Checking in…" : "I'm here"}
        </button>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="confirm-wrap">
        <div className="confirm-icon">✓</div>
        <h2>You're pre-registered</h2>
        <p className="helper-text">
          When you arrive, open this same link again and tap "I'm here" to check in.
        </p>
      </div>
    );
  }

  if (stage === "arrived") {
    return (
      <div className="confirm-wrap">
        <div className="confirm-icon">✓</div>
        <h2>You're checked in</h2>
        <p className="helper-text">Your host has been informed and will be with you soon.</p>
      </div>
    );
  }

  // status === "invited" -> collect the visitor's own details first.
  if (stage === "details") {
    return (
      <div>
        <h3>Complete your pre-registration</h3>
        <label>Full name</label>
        <input
          type="text"
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
        <label>Phone</label>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
        <label>Company / organization</label>
        <input
          type="text"
          value={values.company}
          onChange={(e) => setValues({ ...values, company: e.target.value })}
        />
        <button
          className="btn btn-primary"
          onClick={() => setStage("photo")}
          disabled={!values.full_name.trim()}
        >
          Continue
        </button>
      </div>
    );
  }

  if (stage === "photo") {
    return (
      <div>
        <h3>Add your photo</h3>
        <PhotoCapture capturedPhoto={photo} onCapture={setPhoto} />
        {photo && (
          <button className="btn btn-primary" onClick={() => setStage("signature")}>
            Continue
          </button>
        )}
      </div>
    );
  }

  if (stage === "signature") {
    return (
      <div>
        <h3>Sign the visitor NDA</h3>
        {submitting ? (
          <p className="helper-text">Submitting…</p>
        ) : (
          <SignaturePad signed={null} onSign={completePreregistration} />
        )}
      </div>
    );
  }

  return null;
}

export default function CheckinPage() {
  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <div className="brand">Reception<span className="dot">·</span>Check-in</div>
      </div>
      <div className="card">
        <Suspense fallback={<p className="helper-text">Loading…</p>}>
          <CheckinInner />
        </Suspense>
      </div>
    </main>
  );
}
