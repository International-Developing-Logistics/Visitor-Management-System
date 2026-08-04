"use client";

import { useState } from "react";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reception";

export default function BrandHeader({ label = "Check-in" }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {!logoFailed && (
        <img
          src="/logo.png"
          alt=""
          onError={() => setLogoFailed(true)}
          style={{ height: 26, width: "auto", display: "block" }}
        />
      )}
      <span>
        {COMPANY_NAME}
        <span className="dot">·</span>{label}
      </span>
    </div>
  );
}
