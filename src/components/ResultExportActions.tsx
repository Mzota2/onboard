import { Download, Printer, MailCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { type Candidate, type Position } from "@/lib/firebase/types";
import { useMemo } from "react";

type Phase = "phase1" | "phase2" | "final";

interface ResultExportActionsProps {
  candidate: Candidate;
  position?: Position;
  phase: Phase;
  averageScore: number;
  interviewCount: number;
  phaseScores?: { phase1?: number; phase2?: number };
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

function createSummaryText(
  candidate: Candidate,
  position: Position | undefined,
  phase: Phase,
  averageScore: number,
  interviewCount: number,
  phaseScores?: { phase1?: number; phase2?: number },
) {
  const positionTitle = position?.title ?? "Hiring";
  const lines = [
    `${candidate.name} (${candidate.code})`,
    `Current role: ${candidate.currentRole}`,
    `Position: ${positionTitle}`,
    `Phase: ${phase === "final" ? "Final summary" : phase === "phase1" ? "Phase 1" : "Phase 2"}`,
    phaseScores?.phase1 !== undefined ? `Phase 1 score: ${phaseScores.phase1}%` : null,
    phaseScores?.phase2 !== undefined ? `Phase 2 score: ${phaseScores.phase2}%` : null,
    `Aggregate score: ${averageScore}%`,
    `Completed evaluations: ${interviewCount}`,
    "",
    "Evaluation summary",
    `• Phase 1 results are ${phaseScores?.phase1 !== undefined ? `${phaseScores.phase1}%` : "not available"}`,
    `• Phase 2 results are ${phaseScores?.phase2 !== undefined ? `${phaseScores.phase2}%` : "not available"}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

function createLetter(
  candidate: Candidate,
  position: Position | undefined,
  phase: Phase,
  decision: "offer" | "regret",
) {
  const positionTitle = position?.title ?? "this role";
  const scoreLine = `Final aggregate score: ${candidate.aggregateScore}%`;
  const intro = `Dear ${candidate.name},\n\nThank you for participating in the ${positionTitle} interview process.`;
  const body =
    decision === "offer"
      ? `\n\nWe are pleased to extend an offer for the ${candidate.currentRole} role. Your performance across the ${phase === "final" ? "Phase 1 and Phase 2" : phase === "phase2" ? "Phase 2" : "Phase 1"} evaluation was strong, and your results support a positive recommendation.`
      : `\n\nAfter careful review, we have decided not to move forward with an offer at this time. This decision reflects the competitive nature of the ${positionTitle} candidate pool and the evaluation outcomes.`;

  const nextSteps =
    decision === "offer"
      ? `\n\nNext steps:\n- We will share a formal offer package shortly.\n- Please confirm your interest within 3 business days.`
      : `\n\nThank you again for your time and interest. Please feel free to reapply for future opportunities that match your experience.`;

  return `${intro}\n\n${scoreLine}${body}${nextSteps}\n\nBest regards,\n${position?.title ?? "Hiring"} Team`;
}

export function ResultExportActions({
  candidate,
  position,
  phase,
  averageScore,
  interviewCount,
  phaseScores,
}: ResultExportActionsProps) {
  const summaryText = useMemo(
    () => createSummaryText(candidate, position, phase, averageScore, interviewCount, phaseScores),
    [candidate, position, phase, averageScore, interviewCount, phaseScores],
  );

  const offerLetter = useMemo(
    () => createLetter(candidate, position, phase, "offer"),
    [candidate, position, phase],
  );

  const regretLetter = useMemo(
    () => createLetter(candidate, position, phase, "regret"),
    [candidate, position, phase],
  );

  const handlePrint = () => {
    if (typeof window !== "undefined" && window.print) {
      window.print();
      return;
    }
    toast.error("Print is unavailable in this environment.");
  };

  const handleDownloadSummary = () => {
    downloadTextFile(`${candidate.name.replace(/\s+/g, "-").toLowerCase()}-summary.txt`, summaryText);
    toast.success("Summary downloaded");
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Unable to copy to clipboard.");
    }
  };

  return (
    <article className="bp-card mt-5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="bp-label">Export & Publication</p>
          <p className="bp-meta mt-2 max-w-2xl">
            Save a shareable result summary, print a PDF-friendly report, or use the letter templates below to publish candidate outcome notices.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:w-[320px]">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-ink px-4 py-3 text-[11px] uppercase tracking-widest text-surface bp-press"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadSummary}
            className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-surface px-4 py-3 text-[11px] uppercase tracking-widest bp-press"
          >
            <Download className="h-4 w-4" /> Download Summary
          </button>
        </div>
      </div>

      {(phase === "phase2" || phase === "final") && (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 rounded border-2 border-ink bg-surface-dim p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm font-bold uppercase">Offer letter</p>
                <p className="bp-meta text-[11px]">Use this template to communicate a successful interview outcome.</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(offerLetter, "Offer letter")}
                className="inline-flex items-center gap-2 rounded border-2 border-ink bg-ink px-3 py-2 text-[10px] uppercase tracking-widest text-surface bp-press"
              >
                <MailCheck className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-ink/20 bg-surface p-3 text-[12px] leading-6">{offerLetter}</pre>
          </div>

          <div className="grid gap-3 rounded border-2 border-ink bg-surface-dim p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm font-bold uppercase">Regret letter</p>
                <p className="bp-meta text-[11px]">Use this template for candidates who are not selected at this stage.</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(regretLetter, "Regret letter")}
                className="inline-flex items-center gap-2 rounded border-2 border-ink bg-ink px-3 py-2 text-[10px] uppercase tracking-widest text-surface bp-press"
              >
                <XCircle className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-ink/20 bg-surface p-3 text-[12px] leading-6">{regretLetter}</pre>
          </div>
        </div>
      )}
    </article>
  );
}
