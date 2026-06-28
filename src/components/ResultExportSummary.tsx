import { Download, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import type { Candidate, Position } from "@/lib/firebase/types";

interface ResultExportSummaryProps {
  position?: Position;
  phase: "phase1" | "phase2";
  candidates: Candidate[];
}

interface PhaseScoreState {
  label: string;
  isScored: boolean;
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

export function formatPhaseScore(scores: { technicalDepth?: number | null; clarity?: number | null; impact?: number | null } | null): PhaseScoreState {
  if (!scores) {
    return { label: "Pending", isScored: false };
  }

  const values = [scores.technicalDepth, scores.clarity, scores.impact];
  const hasValidScores = values.every((value) => typeof value === "number" && Number.isFinite(value));

  if (!hasValidScores) {
    return { label: "Pending", isScored: false };
  }

  const total = values.reduce((sum, value) => sum + (value ?? 0), 0);
  const percentage = Math.round((total / 3) * 20);

  return { label: `${percentage}%`, isScored: true };
}

function createTextSummary(position: Position | undefined, phase: "phase1" | "phase2", candidates: Candidate[]) {
  const title = `${position?.title ?? "Hiring"} ${phase === "phase1" ? "Phase 1" : "Phase 2"} Results Summary`;
  const scoredCandidates = candidates.filter((candidate) => {
    const rawScores = phase === "phase1" ? candidate.phase1Scores : candidate.phase2Scores;
    return formatPhaseScore(rawScores).isScored;
  });
  const pendingCandidates = candidates.filter((candidate) => {
    const rawScores = phase === "phase1" ? candidate.phase1Scores : candidate.phase2Scores;
    return !formatPhaseScore(rawScores).isScored;
  });

  const header = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    `Candidates included: ${candidates.length}`,
    `Scored: ${scoredCandidates.length}`,
    `Pending review: ${pendingCandidates.length}`,
    "",
  ];

  const buildCandidateBlock = (candidate: Candidate) => {
    const rawScores = phase === "phase1" ? candidate.phase1Scores : candidate.phase2Scores;
    const scoreState = formatPhaseScore(rawScores);
    const notes = phase === "phase1" ? candidate.phase1Scores?.notes : candidate.phase2Scores?.notes;
    return [
      `Name: ${candidate.name} (${candidate.code})`,
      `Role: ${candidate.currentRole}`,
      `Score: ${scoreState.label}`,
      notes ? `Notes: ${notes}` : null,
      "",
    ].filter(Boolean).join("\n");
  };

  const sections = [
    ["Scored candidates", ...scoredCandidates.map(buildCandidateBlock)],
    ["Pending review", ...pendingCandidates.map(buildCandidateBlock)],
  ];

  const renderedSections = sections.flatMap(([heading, ...lines]) => {
    const hasContent = lines.some((line) => line && line.trim().length > 0);
    if (!hasContent) {
      return [];
    }
    return [heading, ...lines, ""];
  });

  return [...header, ...renderedSections].join("\n");
}

export function ResultExportSummary({ position, phase, candidates }: ResultExportSummaryProps) {
  const textSummary = useMemo(() => createTextSummary(position, phase, candidates), [position, phase, candidates]);

  const scoredCount = useMemo(
    () => candidates.filter((candidate) => {
      const rawScores = phase === "phase1" ? candidate.phase1Scores : candidate.phase2Scores;
      return formatPhaseScore(rawScores).isScored;
    }).length,
    [candidates, phase],
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
    <article className="bp-card mt-4 overflow-hidden">
      <div className="border-b border-ink/20 bg-surface-dim p-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded border border-ink/30 bg-surface px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-ink">
              <Sparkles className="h-3.5 w-3.5" /> Export summary
            </div>
            <h2 className="mt-2 text-xl font-display font-bold tracking-tight">
              {position?.title ?? "Hiring"} {phase === "phase1" ? "Phase 1" : "Phase 2"} candidate summary
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download or print a consolidated evaluation summary.
            </p>
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

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-ink/20 bg-surface p-2">
            <p className="bp-label">Included</p>
            <p className="mt-1 font-display text-lg font-bold">{candidates.length}</p>
          </div>
          <div className="rounded border border-ink/20 bg-surface p-2">
            <p className="bp-label">Scored</p>
            <p className="mt-1 font-display text-lg font-bold">{scoredCount}</p>
          </div>
          <div className="rounded border border-ink/20 bg-surface p-2">
            <p className="bp-label">Pending</p>
            <p className="mt-1 font-display text-lg font-bold">{candidates.length - scoredCount}</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="rounded border border-ink/20 bg-surface-dim p-3 text-[12px] leading-6 whitespace-pre-wrap">
          {textSummary}
        </div>
      </div>
    </article>
  );
}
