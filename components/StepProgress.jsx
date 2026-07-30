"use client";

export default function StepProgress({ steps, currentIndex }) {
  return (
    <div className="steps">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`step ${i === currentIndex ? "active" : i < currentIndex ? "done" : ""}`}
        >
          <span className="step-num">{i < currentIndex ? "✓" : i + 1}</span>
          {label}
        </div>
      ))}
    </div>
  );
}
