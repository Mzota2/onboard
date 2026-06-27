import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import type { Candidate, Position } from "@/lib/firebase/types";

interface ResultExportSummaryProps {
  position?: Position;
  phase: "phase1" | "phase2";
  candidates: Candidate[];
}

function downloadTextFile(filename: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatScore(scores: { technicalDepth: number; clarity: number; impact: number } | null): string {
  if (!scores) return "—";
  const total = scores.technicalDepth + scores.clarity + scores.impact;
  return `${Math.round(total / 3 * 20)}%`;
}

function createTextSummary(position: Position | undefined, phase: "phase1" | "phase2", candidates: Candidate[]) {
  const title = `${position?.title ?? "Hiring"} ${phase === "phase1" ? "Phase 1" : "Phase 2"} Results Summary`;
  const header = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    `Candidates included: ${candidates.length}`,
    "",
  ];

  const rows = candidates.map((candidate) => {
    const score = phase === "phase1" ? formatScore(candidate.phase1Scores) : formatScore(candidate.phase2Scores);
    const notes = phase === "phase1" ? candidate.phase1Scores?.notes : candidate.phase2Scores?.notes;
    return [
      `Name: ${candidate.name} (${candidate.code})`,
      `Role: ${candidate.currentRole}`,
      `Score: ${score}`,
      notes ? `Notes: ${notes}` : null,
      "",
    ].filter(Boolean).join("\n");
  });

  return [...header, ...rows].join("\n");
}

export function ResultExportSummary({ position, phase, candidates }: ResultExportSummaryProps) {
  const title = `${position?.title ?? "Hiring"} ${phase === "phase1" ? "Phase 1" : "Phase 2"} Candidate Summary`;

  const textSummary = useMemo(
    () => createTextSummary(position, phase, candidates),
    [position, phase, candidates],
  );

  const handlePrint = () => {
    if (typeof window !== "undefined" && window.print) {
      window.print();
      return;
    }
    toast.error("Print is unavailable in this browser.");
  };

  const handleDownload = () => {
    downloadTextFile(
      `${(position?.title ?? "results").replace(/\s+/g, "-").toLowerCase()}-${phase}-summary.txt`,
      textSummary,
    );
    toast.success("Summary downloaded");
  };

  return (
    <article className="bp-card mt-5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="bp-label">Export summary</p>
          <p className="bp-meta mt-2">Download or print a consolidated evaluation summary for the selected phase.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-ink px-4 py-3 text-[11px] uppercase tracking-widest text-surface bp-press"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-surface px-4 py-3 text-[11px] uppercase tracking-widest bp-press"
          >
            <Download className="h-4 w-4" /> Download Summary
          </button>
        </div>
      </div>
      <div className="mt-5 rounded border border-ink/20 bg-surface-dim p-4 text-[12px] leading-6 whitespace-pre-wrap">{textSummary}</div>
    </article>
  );
}
