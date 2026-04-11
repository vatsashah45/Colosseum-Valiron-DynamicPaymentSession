"use client";

const TIERS = [
  { tier: "AAA", score: "95+",  limit: "$100", duration: "60 min", maxReq: "Unlimited", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  { tier: "AA",  score: "85–94", limit: "$50",  duration: "45 min", maxReq: "50",        color: "text-green-400",   bg: "bg-green-400/10",   border: "border-green-400/30" },
  { tier: "A",   score: "75–84", limit: "$25",  duration: "30 min", maxReq: "30",        color: "text-teal-400",    bg: "bg-teal-400/10",    border: "border-teal-400/30" },
  { tier: "BAA", score: "65–74", limit: "$10",  duration: "20 min", maxReq: "20",        color: "text-yellow-400",  bg: "bg-yellow-400/10",  border: "border-yellow-400/30" },
  { tier: "BA",  score: "55–64", limit: "$5",   duration: "15 min", maxReq: "10",        color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/30" },
  { tier: "B",   score: "45–54", limit: "$1",   duration: "10 min", maxReq: "5",         color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/30" },
];

export default function TierTable({ activeTier }: { activeTier?: string }) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-left text-white/60">
            <th className="px-4 py-3 font-medium">Tier</th>
            <th className="px-4 py-3 font-medium">Score Range</th>
            <th className="px-4 py-3 font-medium">Credit Line</th>
            <th className="px-4 py-3 font-medium">Channel Duration</th>
            <th className="px-4 py-3 font-medium">Max Requests</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => (
            <tr
              key={t.tier}
              className={`border-t border-white/5 transition-colors ${
                activeTier === t.tier
                  ? `${t.bg} ${t.border} border-l-2`
                  : "hover:bg-white/[0.02]"
              }`}
            >
              <td className="px-4 py-3">
                <span className={`font-mono font-bold ${t.color}`}>
                  {t.tier}
                </span>
              </td>
              <td className="px-4 py-3 text-white/70">{t.score}</td>
              <td className="px-4 py-3 font-mono text-white/90">{t.limit}</td>
              <td className="px-4 py-3 text-white/70">{t.duration}</td>
              <td className="px-4 py-3 text-white/70">{t.maxReq}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-white/[0.02] text-xs text-white/30 border-t border-white/5">
        Agents scoring below 45 are rejected. Credit lines in USDC on Solana. One settlement tx at channel close.
      </div>
    </div>
  );
}
