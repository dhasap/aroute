"use client";

import MagicCircle from "./MagicCircle";

// Letter-by-letter anime-style heading reveal
function GlitchChars({ text, baseDelay = 0 }) {
  return (
    <>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="char-in"
          style={{ animationDelay: `${baseDelay + i * 28}ms` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </>
  );
}

export default function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 px-6 min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Anime banner art background */}
      <div className="absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none" style={{ backgroundImage: "url(/banner-anime.jpg)" }} aria-hidden="true"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#12101f]/60 via-transparent to-[#12101f] pointer-events-none" aria-hidden="true"></div>
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#8B5CF6]/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Rotating magic circle behind content */}
      <MagicCircle size={680} opacity={0.22} />

      <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center gap-8">
        {/* Katakana accent */}
        <div className="animate-katakana text-xs md:text-sm text-[#8B5CF6]/80 font-medium tracking-[0.25em] select-none" aria-hidden="true">
          プロキシ・ゲートウェイ
        </div>

        {/* Version badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#2c2650] bg-[#17142c]/50 px-3 py-1 text-xs font-medium text-[#8B5CF6]">
          <span className="flex h-2 w-2 rounded-full bg-[#8B5CF6] animate-pulse"></span>
          v1.0 is now live
        </div>

        {/* Main heading — letter-by-letter reveal + neon glow */}
        <h1 className="text-5xl md:text-7xl font-hand font-bold leading-[1.1] tracking-tight">
          <span className="text-white"><GlitchChars text="One Endpoint for" /></span>
          <br/>
          <span className="text-[#8B5CF6] animate-hero-glow"><GlitchChars text="All AI Providers" baseDelay={420} /></span>
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-light">
          AI endpoint proxy with web dashboard - A JavaScript port of CLIProxyAPI. Works seamlessly with Claude Code, OpenAI Codex, Cline, RooCode, and other CLI tools.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <button className="shine-sweep h-12 px-8 sketch-pill !border-2 !border-[#8B5CF6] bg-[#8B5CF6] hover:bg-[#7445dd] text-[#12101f] text-base font-bold transition-all shadow-[3px_4px_0_rgba(139,92,246,0.35)] flex items-center gap-2">
            <span className="material-symbols-outlined">rocket_launch</span>
            Get Started
          </button>
          <a
            href="https://github.com/dhasap/aroute"
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 px-8 sketch-pill !border-2 !border-[#2c2650] bg-[#17142c] hover:bg-[#2c2650] text-white text-base font-bold transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">code</span>
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
