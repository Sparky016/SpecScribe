import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono rounded-full border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66]">
          Learn AR with SPECS • Devpost Hackathon
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] to-[#00E5FF]">
            SpecScribe AR
          </span>
        </h1>
        <p className="text-gray-400 text-lg">
          Spatial Whiteboard-to-Draw.io Digital Twin, Proactive AI Critique, and Post-Meeting Temporal Decision Scrubber.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/meetings/demo-session-01"
            className="px-6 py-3 rounded-lg bg-[#00FF66] text-black font-semibold hover:bg-[#00e55c] transition-colors"
          >
            Launch Review Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
