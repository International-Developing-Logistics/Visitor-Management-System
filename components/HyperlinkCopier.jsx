"use client";

import { useState } from "react";

export default function HyperlinkCopier({ url, defaultText = "Click here to join" }) {
  const [linkText, setLinkText] = useState(defaultText);
  const [copiedPlain, setCopiedPlain] = useState(false);
  const [copiedRich, setCopiedRich] = useState(false);

  const copyPlainUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopiedPlain(true);
    setTimeout(() => setCopiedPlain(false), 2000);
  };

  const copyAsHyperlink = async () => {
    const html = `<a href="${url}">${linkText || defaultText}</a>`;
    try {
      if (navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([linkText || defaultText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopiedRich(true);
      setTimeout(() => setCopiedRich(false), 2000);
    } catch {
      await navigator.clipboard.writeText(url);
      setCopiedRich(true);
      setTimeout(() => setCopiedRich(false), 2000);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 10,
        }}
      >
        <input
          type="text"
          readOnly
          value={url}
          style={{ border: "none", background: "none", padding: 0, flex: 1, fontSize: "0.85rem" }}
          onFocus={(e) => e.target.select()}
        />
        <button className="btn-small" onClick={copyPlainUrl} style={{ flexShrink: 0 }}>
          {copiedPlain ? "Copied ✓" : "Copy URL"}
        </button>
      </div>

      <label style={{ marginTop: 0 }}>Link text (for pasting into email as a hyperlink)</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          placeholder={defaultText}
          style={{ flex: 1 }}
        />
        <button className="btn-small" onClick={copyAsHyperlink} style={{ flexShrink: 0 }}>
          {copiedRich ? "Copied ✓" : "Copy as link"}
        </button>
      </div>
      <p className="helper-text" style={{ marginTop: 8 }}>
        Preview:{" "}
        <a href={url} target="_blank" rel="noreferrer">
          {linkText || defaultText}
        </a>
      </p>
    </div>
  );
}
