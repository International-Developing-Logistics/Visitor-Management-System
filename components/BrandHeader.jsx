"use client";

import { useState } from "react";

const DEFAULT_COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reception";

export default function BrandHeader({ label = "Check-in", companyName, logoSrc = "/logo.png", logoHeight = 26 }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const name = companyName || DEFAULT_COMPANY_NAME;

  return (
    <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {!logoFailed && (
        <img
          src={logoSrc}
          alt=""
          onError={() => setLogoFailed(true)}
          style={{ height: logoHeight, width: "auto", display: "block" }}
        />
      )}
      <span>
        {name}
        <span className="dot">·</span>{label}
      </span>
    </div>
  );
}
