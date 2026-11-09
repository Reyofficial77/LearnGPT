"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, RefreshCw, X } from "react-feather";
import type { Dict } from "../lib/i18n";

export default function CameraCapture({ t, onCapture, onClose }: { t: Dict; onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let active = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError(t.cameraUnavailable); setStarting(false); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      } catch { if (active) setError(t.cameraUnavailable); }
      finally { if (active) setStarting(false); }
    };
    void start();
    return () => { active = false; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [t.cameraUnavailable]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) return;
    setCapturing(true);
    try {
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not capture the image.")), "image/jpeg", 0.88));
      onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    } catch { setError(t.cameraUnavailable); }
    finally { setCapturing(false); }
  };

  return <div className="camera-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="camera-modal" role="dialog" aria-modal="true" aria-label={t.camera}>
      <header className="camera-heading"><span><Camera size={18}/>{t.camera}</span><button className="icon-button" onClick={onClose} aria-label={t.closeCamera}><X size={18}/></button></header>
      <div className="camera-view">
        <video ref={videoRef} autoPlay muted playsInline />
        {starting && <div className="camera-state"><RefreshCw className="spin" size={20}/><span>{t.loadingWorkspace}</span></div>}
        {error && <div className="camera-state camera-error">{error}</div>}
      </div>
      <footer className="camera-footer">
        <button className="settings-cancel" onClick={onClose}>{t.cancel}</button>
        <button className="settings-save" onClick={capture} disabled={starting || !!error || capturing}>{capturing ? <RefreshCw size={16} className="spin"/> : <Check size={16}/>} {t.capture}</button>
      </footer>
    </section>
  </div>;
}
