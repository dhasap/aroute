"use client";

/**
 * MagicCircle — rotating arcane rune ring behind hero content.
 * Pure CSS rotation over the generated magic-circle webp.
 */
export default function MagicCircle({ size = 620, opacity = 0.25 }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: size, height: size }}
    >
      <img
        src="/animefx/magiccircle.webp"
        alt=""
        className="w-full h-full object-contain"
        style={{
          opacity,
          filter: "drop-shadow(0 0 24px rgba(139,92,246,0.45))",
          animation: "mc-spin 60s linear infinite",
        }}
      />
      {/* counter-rotating inner ring for depth */}
      <img
        src="/animefx/magiccircle.webp"
        alt=""
        className="absolute inset-[12%] w-[76%] h-[76%] object-contain"
        style={{
          opacity: opacity * 0.6,
          animation: "mc-spin-reverse 45s linear infinite",
          filter: "hue-rotate(25deg)",
        }}
      />
    </div>
  );
}
