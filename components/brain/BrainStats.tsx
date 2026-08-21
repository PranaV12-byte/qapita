"use client";

import type { CoverageSummary } from "@/components/brain/BrainGraph";

export default function BrainStats({ sources, passages, lastLintAt, coverage }: { sources: number; passages: number; lastLintAt: string | null; coverage: CoverageSummary }) {
  return <div className="v9-brain-stats">
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Company sources" value={String(sources)} />
      <Stat label="Connected passages" value={String(passages)} />
      <Stat label="Workspace check" value={lastLintAt ? new Date(lastLintAt).toLocaleDateString() : "Not run"} />
      <Stat label="Topics connected" value={`${coverage.coveredTopics} / ${coverage.totalTopics}`} />
    </div>
    <p>Coverage is shown in the graph and reflects company-source connections.</p>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="truncate text-lg font-semibold text-[#1f2937]">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#9ca3af]">{label}</div></div>;
}
