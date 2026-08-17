"use client";

import { useEffect, useRef, useState } from "react";

// Calls onCapture(dataUrl) once a photo is taken. onCapture(null) clears it.
export default function CameraCapture({ onCapture, capturedPhoto, label = "Take photo" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (capturedPhoto) return;
    let active = true;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
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
          <img src={capturedPhoto} alt="Captured photo" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted />
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {capturedPhoto ? (
        <button type="button" className="btn-small" onClick={retake}>
          Retake
        </button>
      ) : (
        <button type="button" className="btn-small" onClick={takePhoto} disabled={!ready}>
          {ready ? label : "Starting camera…"}
        </button>
      )}
    </div>
  );
}
