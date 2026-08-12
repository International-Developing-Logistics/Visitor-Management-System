"use client";

import { useState } from "react";

const NDA_TEXT = `By checking the box below, you acknowledge that during your visit you may be
exposed to confidential or proprietary information belonging to the company.
You agree not to disclose, copy, or use any such information for any purpose
other than the stated purpose of your visit, and to follow all site safety
and security guidance given by your host or staff during your time on the
premises. This acknowledgment applies for the duration of your visit today.`;

// onAgree() is called once the visitor checks the box and clicks Continue —
// no signature capture involved, just a binding confirmation click.
export default function AgreementStep({ onAgree, submitting }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <div className="nda-box">{NDA_TEXT}</div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 2 }}
        />
        <span style={{ fontWeight: 400, color: "var(--ink)" }}>
          I have read and agree to the terms above.
        </span>
      </label>

      <button
        className="btn btn-primary"
        onClick={onAgree}
        disabled={!agreed || submitting}
        type="button"
      >
        {submitting ? "Submitting…" : "Confirm and submit"}
      </button>
    </div>
  );
}
