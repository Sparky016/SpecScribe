import Link from "next/link";
import {
  Sparkles,
  Layers,
  Clock,
  Download,
  Bot,
  ShieldAlert,
  ArrowRight,
  Glasses,
  Database,
  Cpu,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070a0f] text-gray-100 flex flex-col justify-between selection:bg-[#00FF66] selection:text-black">
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none opacity-25">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#00FF66]/20 to-[#00E5FF]/20 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66]">
            <Glasses className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white">
              SpecScribe <span className="text-[#00FF66]">AR</span>
            </span>
            <span className="block text-[10px] font-mono text-gray-400">
              Snap Spectacles 2024 • Temporal Digital Twin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/meetings"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] text-black font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-[#00FF66]/20"
          >
            <span>Sign in to your meetings</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66] text-xs font-mono mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Learn AR with SPECS • Devpost Hackathon 2026</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl leading-[1.1]">
          From Spatial Whiteboard to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-[#00E5FF] to-cyan-300">
            Temporal Digital Twin
          </span>
        </h1>

        <p className="mt-6 text-gray-300 text-base sm:text-xl max-w-2xl leading-relaxed">
          Real-time physical whiteboard digitization for Snap Spectacles, autonomous
          proactive AI architecture critique, and post-meeting temporal decision scrubbing
          grounded in <span className="text-[#00E5FF] font-mono">pgvector</span>.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/meetings"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] text-black font-bold text-sm sm:text-base transition-all shadow-xl shadow-[#00FF66]/25 hover:scale-105"
          >
            <span>Review your meetings</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/meetings/demo-session-01"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-[#00FF66]/40 text-gray-100 text-sm sm:text-base font-semibold transition-all"
          >
            <span>Explore Demo Meeting</span>
          </Link>
          <a
            href="https://github.com/ruanp/SpecScribe"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-gray-200 text-sm sm:text-base font-semibold transition-all"
          >
            <span>View Architecture Spec & Repo</span>
          </a>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-[#0d121c]/90 border border-white/10 hover:border-[#00FF66]/40 transition-all shadow-xl group">
            <div className="p-3 rounded-xl bg-[#107C41]/20 border border-[#00FF66]/30 text-[#00FF66] w-fit mb-4 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Temporal Decision Scrubber
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Scrub backwards through time to see the whiteboard evolve node-by-node.
              Every diagram snapshot is synchronized with diarized speaker speech and rationale.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-[#0d121c]/90 border border-white/10 hover:border-[#00E5FF]/40 transition-all shadow-xl group">
            <div className="p-3 rounded-xl bg-[#0D47A1]/20 border border-[#00E5FF]/30 text-[#00E5FF] w-fit mb-4 group-hover:scale-110 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              Raising-Hand AI Teammate
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Autonomous background agent checks for architectural flaws, security
              vulnerabilities, and cache stampedes every 20 seconds, raising floating pills in AR.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-[#0d121c]/90 border border-white/10 hover:border-amber-400/40 transition-all shadow-xl group">
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 w-fit mb-4 group-hover:scale-110 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              1-Click Verified Exports
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Instantly export editable <span className="font-mono text-[#00FF66]">.drawio</span> XML
              diagrams, Gemini-compiled Markdown Technical Specs, and structured JSON decision logs.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-white/10 text-center text-xs text-gray-500 font-mono z-10 backdrop-blur-md">
        SpecScribe AR • Snap Spectacles 2024 Developer Preview & Next.js 15 App Router Hub
      </footer>
    </main>
  );
}
