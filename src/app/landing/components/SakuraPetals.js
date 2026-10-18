"use client";

import { useEffect, useRef } from "react";

/**
 * SakuraPetals — falling sakura petal particles (canvas).
 * Uses /animefx/petal.png sprite; sway + rotation; pauses when tab hidden.
 */
export default function SakuraPetals({ density = 16, maxPetals }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let running = true;

    const sprite = new Image();
    sprite.src = "/animefx/petal.png";

    let petals = [];
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };
    resize();

    const spawn = (initial) => ({
      x: Math.random() * canvas.width,
      y: initial ? Math.random() * canvas.height : -40 * DPR,
      size: (10 + Math.random() * 14) * DPR,
      speedY: (0.5 + Math.random() * 1.1) * DPR,
      swayAmp: (20 + Math.random() * 40) * DPR,
      swayFreq: 0.001 + Math.random() * 0.002,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      opacity: 0.35 + Math.random() * 0.4,
    });

    const n = maxPetals != null ? Math.min(density, maxPetals) : density;
    for (let i = 0; i < n; i++) petals.push(spawn(true));

    let t = 0;
    const draw = () => {
      if (!running) return;
      t += 16;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (sprite.complete && sprite.naturalWidth > 0) {
        for (const p of petals) {
          p.y += p.speedY;
          p.phase += p.swayFreq * 16;
          p.rot += p.rotSpeed;
          const x = p.x + Math.sin(p.phase) * p.swayAmp;
          if (p.y > canvas.height + 60) {
            Object.assign(p, spawn(false));
          }
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size * 1.3);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        draw();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
    };
  }, [density, maxPetals]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1] pointer-events-none"
    />
  );
}
