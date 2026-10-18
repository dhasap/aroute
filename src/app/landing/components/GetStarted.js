"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Reveal from "./Reveal";

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = (text) => {
    copy(text, "landing");
  };

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      {/* Manga speed-lines dramatic background */}
      <div
        className="absolute inset-0 speedline-bg opacity-[0.07] pointer-events-none"
        aria-hidden="true"
      ></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#12101f] via-transparent to-[#12101f] pointer-events-none" aria-hidden="true"></div>

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left: Steps + mascot */}
          <div className="flex-1">
            <Reveal>
              <div className="flex items-start gap-4">
                <img
                  src="/animefx/mascot-wave.png"
                  alt="ARoute mascot waving"
                  className="w-20 h-20 animate-mascot-float select-none"
                  draggable="false"
                />
                <div>
                  <div className="text-xs text-[#8B5CF6]/80 font-medium tracking-[0.25em] mb-1 select-none" aria-hidden="true">はじめに</div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-2">Get Started in 30 Seconds</h2>
                  <p className="text-gray-400 text-lg">
                    Install ARoute, configure your providers via web dashboard, and start routing AI requests.
                  </p>
                </div>
              </div>
            </Reveal>

            <div className="flex flex-col gap-6 mt-8">
              <Reveal variant="left" delay={100}>
                <div className="flex gap-4">
                  <div className="flex-none w-8 h-8 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center font-bold">1</div>
                  <div>
                    <h4 className="font-bold text-lg">Install ARoute</h4>
                    <p className="text-sm text-gray-500 mt-1">Run npx command to start the server instantly</p>
                  </div>
                </div>
              </Reveal>

              <Reveal variant="left" delay={200}>
                <div className="flex gap-4">
                  <div className="flex-none w-8 h-8 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center font-bold">2</div>
                  <div>
                    <h4 className="font-bold text-lg">Open Dashboard</h4>
                    <p className="text-sm text-gray-500 mt-1">Configure providers and API keys via web interface</p>
                  </div>
                </div>
              </Reveal>

              <Reveal variant="left" delay={300}>
                <div className="flex gap-4">
                  <div className="flex-none w-8 h-8 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center font-bold">3</div>
                  <div>
                    <h4 className="font-bold text-lg">Route Requests</h4>
                    <p className="text-sm text-gray-500 mt-1">Point your CLI tools to http://localhost:20128</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Right: Code block */}
          <Reveal variant="right" className="flex-1 w-full">
            <div className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-[#2c2650] shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#252526] border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="ml-2 text-xs text-gray-500 font-mono">terminal</div>
                <img src="/animefx/mascot-hacker.png" alt="" className="ml-auto w-8 h-8 opacity-80" aria-hidden="true" draggable="false" />
              </div>
              
              {/* Terminal content */}
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                <div 
                  className="flex items-center gap-2 mb-4 group cursor-pointer"
                  onClick={() => handleCopy("npx aroute")}
                >
                  <span className="text-green-400">$</span>
                  <span className="text-white">npx aroute</span>
                  <span className="ml-auto text-gray-500 text-xs opacity-0 group-hover:opacity-100">
                    {copied === "landing" ? "✓ Copied" : "Copy"}
                  </span>
                </div>
                
                <div className="text-gray-400 mb-6">
                  <span className="text-[#8B5CF6]">&gt;</span> Starting ARoute...<br/>
                  <span className="text-[#8B5CF6]">&gt;</span> Server running on <span className="text-blue-400">http://localhost:20128</span><br/>
                  <span className="text-[#8B5CF6]">&gt;</span> Dashboard: <span className="text-blue-400">http://localhost:20128/dashboard</span><br/>
                  <span className="text-green-400">&gt;</span> Ready to route! ✓
                </div>
                
                <div className="text-xs text-gray-500 mb-2 border-t border-gray-700 pt-4">
                  📝 Configure providers in dashboard or use environment variables
                </div>
                
                <div className="text-gray-400 text-xs">
                  <span className="text-purple-400">Data Location:</span><br/>
                  <span className="text-gray-500">  macOS/Linux:</span> ~/.aroute/db/data.sqlite<br/>
                  <span className="text-gray-500">  Windows:</span> %APPDATA%/aroute/db/data.sqlite
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
