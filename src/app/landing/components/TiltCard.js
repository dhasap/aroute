"use client";

import { useRef } from "react";

/**
 * TiltCard — gacha-card 3D tilt following the mouse + shine sweep.
 */
export default function TiltCard({ children, className = "", maxTilt = 10 }) {
  const ref = useRef(null);
  const shineRef = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * maxTilt;
    const ry = (px - 0.5) * maxTilt;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    if (shineRef.current) {
      shineRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.18) 0%, transparent 55%)`;
      shineRef.current.style.opacity = "1";
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
    if (shineRef.current) shineRef.current.style.opacity = "0";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
      <div
        ref={shineRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
      />
    </div>
  );
}
