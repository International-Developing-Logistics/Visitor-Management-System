"use client";

import { useEffect, useRef, useState } from "react";

// A small canvas-based signature pad. Draws in the page's --ink color so
// it looks right in both the form and a printed/PDF view. Calls
// onChange(dataUrl | null) whenever the signature is drawn or cleared -
// the parent form just holds that data URL in state like any other field.
export default function SignaturePad({ value, onChange, label, height = 90 }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Size the canvas to its CSS box at device pixel ratio, then redraw
  // whatever value we currently have (so resizing/orientation changes
  // don't wipe an existing signature).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || height;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (value) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = value;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setHasDrawn(!!value);
  }, [value]);

  const inkColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#16211f";

  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    canvasRef.current.setPointerCapture?.(e.pointerId);
    lastRef.current = pointerPos(e);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const [x, y] = pointerPos(e);
    ctx.strokeStyle = inkColor();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(...lastRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastRef.current = [x, y];
    setHasDrawn(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div>
      {label && <label style={{ marginBottom: 6 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height,
            border: "1px dashed var(--line)",
            borderRadius: 8,
            background: "var(--paper)",
            touchAction: "none",
            cursor: "crosshair",
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasDrawn && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          >
            Sign here
          </span>
        )}
        {hasDrawn && (
          <button
            type="button"
            className="btn-small"
            onClick={clear}
            style={{ position: "absolute", top: 6, right: 6 }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
