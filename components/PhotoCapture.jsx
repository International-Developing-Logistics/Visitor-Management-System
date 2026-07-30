"use client";

import { useEffect, useRef, useState } from "react";

// Calls onCapture(dataUrl) once the visitor takes a photo.
export default function PhotoCapture({ onCapture, capturedPhoto }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (capturedPhoto) return; // already have a photo, skip opening camera
    let active = true;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      })
      .catch(() => setError("Camera access was denied. Please allow camera access and reload."));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [capturedPhoto]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  const retake = () => onCapture(null);

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  return (
    <div>
      <div className="camera-frame">
        {capturedPhoto ? (
          <img src={capturedPhoto} alt="Captured visitor photo" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted />
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {capturedPhoto ? (
        <button className="btn btn-secondary" onClick={retake}>
          Retake photo
        </button>
      ) : (
        <button className="btn btn-primary" onClick={takePhoto} disabled={!ready}>
          {ready ? "Take photo" : "Starting camera…"}
        </button>
      )}
    </div>
  );
}
