"use client";

import { useState } from "react";

const DEFAULT_COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reception";

// companyName/logoSrc are optional overrides for facility-branded pages
// (e.g. IDL's pages pass these explicitly). Omit them and this behaves
// exactly as before, using the global NEXT_PUBLIC_COMPANY_NAME + /logo.png.
export default function BrandHeader({ label = "Check-in", companyName, logoSrc = "/logo.png" }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const name = companyName || DEFAULT_COMPANY_NAME;

  return (
    <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {!logoFailed && (
        <img
          src={logoSrc}
          alt=""
          onError={() => setLogoFailed(true)}
          style={{ height: 26, width: "auto", display: "block" }}
        />
      )}
      <span>
        {name}
        <span className="dot">·</span>{label}
      </span>
    </div>
  );
}
