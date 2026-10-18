"use client";
import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";
import SakuraPetals from "./components/SakuraPetals";
import Reveal from "./components/Reveal";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative text-white font-sans overflow-x-hidden antialiased selection:bg-[#8B5CF6] selection:text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#12101f]">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `linear-gradient(to right, #8B5CF6 1px, transparent 1px), linear-gradient(to bottom, #8B5CF6 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-[#8B5CF6]/12 rounded-full blur-[130px] animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[130px] animate-blob" style={{ animationDelay: '2s', animationDuration: '22s' }}></div>
        <div className="absolute bottom-0 left-1/2 w-[650px] h-[650px] bg-blue-500/8 rounded-full blur-[130px] animate-blob" style={{ animationDelay: '4s', animationDuration: '25s' }}></div>
        
        {/* Vignette effect */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(24, 20, 17, 0.4) 100%)'
        }}></div>
      </div>

      {/* Falling sakura petals */}
      <SakuraPetals density={16} />

      <div className="relative z-10">
        <Navigation />
        
        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
          <HeroSection />
          <div className="flex justify-center pb-20">
            <FlowAnimation />
          </div>
        </div>
        
        <GetStarted />
        <HowItWorks />
        <Features />
        
        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-t from-[#8B5CF6]/5 to-transparent pointer-events-none"></div>
          <Reveal variant="zoom">
            <div className="max-w-4xl mx-auto text-center relative z-10">
              <div className="text-xs text-[#8B5CF6]/80 font-medium tracking-[0.25em] mb-3 select-none" aria-hidden="true">そして、始めよう</div>
              <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to Simplify Your AI Infrastructure?</h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Join developers who are streamlining their AI integrations with ARoute. Open source and free to start.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => router.push("/dashboard")}
                  className="shine-sweep w-full sm:w-auto h-14 px-10 rounded-lg bg-[#8B5CF6] hover:bg-[#7445dd] text-[#12101f] text-lg font-bold transition-all shadow-[0_0_28px_rgba(139,92,246,0.5)] hover:shadow-[0_0_44px_rgba(139,92,246,0.75)]"
                >
                  Start Free
                </button>
                <button 
                  onClick={() => window.open("https://github.com/dhasap/aroute#readme", "_blank")}
                  className="w-full sm:w-auto h-14 px-10 rounded-lg border border-[#2c2650] hover:bg-[#17142c] text-white text-lg font-bold transition-all"
                >
                  Read Documentation
                </button>
              </div>
              {/* happy mascot sees you off */}
              <img
                src="/animefx/mascot-happy.png"
                alt="ARoute mascot celebrating"
                className="mx-auto mt-14 w-32 h-32 animate-mascot-float select-none drop-shadow-[0_0_24px_rgba(139,92,246,0.45)]"
                draggable="false"
              />
            </div>
          </Reveal>
        </section>
        </main>
        
        <Footer />
      </div>
      
      {/* Global styles for keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes blob {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(30px, -50px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
