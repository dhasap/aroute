"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveal — anime-style scroll reveal wrapper (IntersectionObserver).
 * Children fade + slide up (or custom variant) the first time they enter viewport.
 */
export default function Reveal({ children, variant = "up", delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const transforms = {
    up: "translateY(36px)",
    down: "translateY(-36px)",
    left: "translateX(-48px)",
    right: "translateX(48px)",
    zoom: "scale(0.92)",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : transforms[variant] || transforms.up,
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
