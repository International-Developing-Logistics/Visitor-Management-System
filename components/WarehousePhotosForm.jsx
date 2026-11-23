"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";
import { supabase } from "@/lib/supabaseClient";
import { facilityPath } from "@/lib/facilities";
import {
  WAREHOUSE_PHOTOS_BUCKET,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_JPEG_QUALITY,
} from "@/lib/warehousePhotos";

// Open Staff Hub page (no login) for warehouse staff to attach photos to a
// GRN. Photos are resized + re-encoded as JPEG in the browser first: phone
// photos are often 3-8MB each, and 20 of them per GRN would fill the
// Supabase Free plan's 1GB of storage within a handful of submissions.

const NAME_STORAGE_KEY = "warehousePhotos.staffName";
const UPLOAD_CONCURRENCY = 4;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

// Resize so the longest edge is <= PHOTO_MAX_DIMENSION and encode as JPEG.
// Modern browsers apply EXIF orientation when drawing an <img>, so photos
// taken in portrait stay upright.
async function compressPhoto(file) {
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY));
    if (!blob) throw new Error("unreadable");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Parses an API response, tolerating non-JSON bodies so users see a
// readable message instead of "Unexpected token ... is not valid JSON".
async function readApiResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}). Please try again.`);
  if (!data) throw new Error("Unexpected response from the server. Please try again.");
  return data;
}

// Runs `worker` over `items` with at most `limit` in flight at once.
async function runWithConcurrency(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

let photoKeySeq = 0;

export default function WarehousePhotosForm({ facility }) {
  const [staffName, setStaffName] = useState("");
  const [clientName, setClientName] = useState("");
  const [grn, setGrn] = useState("");
  const [containers, setContainers] = useState("");
  const [photos, setPhotos] = useState([]); // [{ key, blob, previewUrl }]
  const [processing, setProcessing] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [submitted, setSubmitted] = useState(null); // { grn, count }
  const fileInputRef = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAME_STORAGE_KEY);
      if (saved) setStaffName(saved);
    } catch {
      // storage unavailable - just don't prefill
    }
    // Free preview URLs when leaving the page.
    return () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, []);

  const addFiles = async (fileList) => {
    setPhotoError("");
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length - processing;
    if (room <= 0) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const accepted = files.slice(0, room);
    let skipped = files.length - accepted.length;
    let failed = 0;

    setProcessing((n) => n + accepted.length);
    for (const file of accepted) {
      try {
        if (!file.type.startsWith("image/")) throw new Error("not an image");
        const blob = await compressPhoto(file);
        if (blob.size > MAX_PHOTO_BYTES) throw new Error("too large");
        const previewUrl = URL.createObjectURL(blob);
        setPhotos((prev) => [...prev, { key: ++photoKeySeq, blob, previewUrl }]);
      } catch {
        failed += 1;
      } finally {
        setProcessing((n) => n - 1);
      }
    }

    const messages = [];
    if (failed) messages.push(`${failed} file(s) couldn't be read as photos and were skipped.`);
    if (skipped) messages.push(`Only ${MAX_PHOTOS} photos allowed - ${skipped} extra skipped.`);
    if (messages.length) setPhotoError(messages.join(" "));
  };

  const removePhoto = (key) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const resetForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setClientName("");
    setGrn("");
    setContainers("");
    setPhotoError("");
    setError("");
    setProgress(null);
    setSubmitted(null);
  };

  const containerCount = containers === "" ? NaN : Number(containers);
  const containersValid = Number.isInteger(containerCount) && containerCount >= 0 && containerCount <= 1000;
  const canSubmit =
    !submitting &&
    processing === 0 &&
    staffName.trim() &&
    clientName.trim() &&
    grn.trim() &&
    containersValid &&
    photos.length > 0;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const toUpload = photos;
    setProgress({ done: 0, total: toUpload.length });
    try {
      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, staffName.trim());
      } catch {
        // ignore
      }

      // 1. One-time signed upload links, one per photo.
      const prep = await readApiResponse(
        await fetch("/api/warehouse-photos/upload-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: toUpload.length }),
        })
      );

      // 2. Upload straight to storage, a few at a time.
      let done = 0;
      await runWithConcurrency(toUpload, UPLOAD_CONCURRENCY, async (photo, i) => {
        const { path, token } = prep.uploads[i];
        const { error: upErr } = await supabase.storage
          .from(WAREHOUSE_PHOTOS_BUCKET)
          .uploadToSignedUrl(path, token, photo.blob, { contentType: "image/jpeg" });
        if (upErr) throw new Error(`A photo failed to upload - please try again. (${upErr.message})`);
        done += 1;
        setProgress({ done, total: toUpload.length });
      });

      // 3. Save the submission.
      await readApiResponse(
        await fetch("/api/warehouse-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facility: facility.key,
            staff_name: staffName,
            client_name: clientName,
            grn,
            container_count: containerCount,
            upload_id: prep.upload_id,
            count: toUpload.length,
          }),
        })
      );

      setSubmitted({ grn: grn.trim(), count: toUpload.length });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Warehouse Photos" companyName={facility.label} logoSrc={facility.logo} logoHeight={facility.logoHeight} />
      </div>

      <div className="card">
        {submitted ? (
          <div className="confirm-wrap">
            <div className="confirm-icon">✓</div>
            <h2>Photos saved</h2>
            <p className="helper-text">
              {submitted.count} photo{submitted.count === 1 ? "" : "s"} saved for GRN {submitted.grn}.
            </p>
            <button className="btn btn-secondary" onClick={resetForm}>
              Add photos for another GRN
            </button>
          </div>
        ) : (
          <div>
            <h3>Warehouse photos</h3>
            <p className="helper-text" style={{ marginBottom: 18 }}>
              Add photos for a GRN - cargo, containers, labels, any damage.
            </p>

            <label htmlFor="wp-name">Your name</label>
            <input id="wp-name" type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Enter your name" />

            <label htmlFor="wp-client">Client name</label>
            <input id="wp-client" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Enter the client name" />

            <label htmlFor="wp-grn">GRN</label>
            <input id="wp-grn" type="text" value={grn} onChange={(e) => setGrn(e.target.value)} placeholder="Enter the GRN number" />

            <label htmlFor="wp-containers">No. of containers</label>
            <input
              id="wp-containers"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={containers}
              onChange={(e) => setContainers(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="eg. 2"
            />
            {containers !== "" && !containersValid && <p className="error-text">Enter a whole number.</p>}

            <label style={{ display: "block", marginTop: 14 }}>
              Photos {photos.length > 0 && <span className="helper-text">({photos.length} of up to {MAX_PHOTOS})</span>}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || photos.length + processing >= MAX_PHOTOS}
              style={{ marginTop: 0 }}
            >
              {photos.length === 0 ? "Take or choose photos" : "Add more photos"}
            </button>
            {processing > 0 && <p className="helper-text">Preparing {processing} photo{processing === 1 ? "" : "s"}…</p>}
            {photoError && <p className="error-text">{photoError}</p>}

            {photos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {photos.map((p, i) => (
                  <div key={p.key} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt={`Photo ${i + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
                    />
                    {!submitting && (
                      <button
                        type="button"
                        onClick={() => removePhoto(p.key)}
                        aria-label={`Remove photo ${i + 1}`}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          fontSize: 16,
                          lineHeight: "26px",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="error-text">{error}</p>}

            <button className="btn btn-primary" onClick={submit} disabled={!canSubmit} style={{ marginTop: 18 }}>
              {submitting
                ? progress && progress.done < progress.total
                  ? `Uploading ${progress.done + 1} of ${progress.total}…`
                  : "Saving…"
                : `Submit${photos.length ? ` ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}`}
            </button>
          </div>
        )}
      </div>

      <p className="helper-text" style={{ marginTop: 18, textAlign: "center" }}>
        <Link href={facilityPath(facility, "/staff")}>← Back to Home</Link>
      </p>
    </main>
  );
}
