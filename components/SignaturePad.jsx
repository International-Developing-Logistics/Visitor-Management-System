"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";

const NDA_TEXT = `By signing below, you acknowledge that during your visit you may be
exposed to confidential or proprietary information belonging to the company.
You agree not to disclose, copy, or use any such information for any purpose
other than the stated purpose of your visit, and to follow all site safety
and security guidance given by your host or staff during your time on the
premises. This acknowledgment applies for the duration of your visit today.`;

export default function SignaturePad({ onSign, signed }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [agreed, setAgreed] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (signed || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = 180 * ratio;
    canvas.getContext("2d").scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(0,0,0,0)",
      penColor: "#16211f",
    });
    pad.addEventListener("endStroke", () => setEmpty(pad.isEmpty()));
    padRef.current = pad;

    return () => pad.off();
  }, [signed]);

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const confirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    onSign(padRef.current.toDataURL("image/png"));
  };

  if (signed) {
    return (
      <div>
        <p className="helper-text" style={{ marginBottom: 10 }}>NDA signed ✓</p>
        <img src={signed} alt="Signature" style={{ maxWidth: 240, border: "1px solid var(--line)", borderRadius: 8 }} />
      </div>
    );
  }

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

      <label>Sign below</label>
      <div className="sig-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      <button className="btn btn-secondary" onClick={clear} type="button">
        Clear signature
      </button>
      <button
        className="btn btn-primary"
        onClick={confirm}
        disabled={!agreed || empty}
        type="button"
      >
        Confirm signature
      </button>
    </div>
  );
}
