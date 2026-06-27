import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ResultExportSummary } from "@/components/ResultExportSummary";
import { useAuth } from "@/contexts/AuthContext";
import { useCandidates, usePositions } from "@/hooks/use-vetting-data";
import { requireAuth } from "@/lib/route-guards";
import { useMemo } from "react";
import { z } from "zod";

const resultsSearchSchema = z.object({
  phase: z.enum(["phase1", "phase2"]).optional(),
});

export const Route = createFileRoute("/results")({
  beforeLoad: requireAuth,
  validateSearch: resultsSearchSchema,
  head: () => ({
    meta: [
      { title: "Results Summary · onboard" },
      { name: "description", content: "Exportable aggregate phase results for the current hiring position." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { isAdmin } = useAuth();
  const { data: positions = [] } = usePositions();
  const activePosition = positions[0];
  const { phase } = Route.useSearch();
  const { data: candidates = [], isLoading } = useCandidates(activePosition?.id);

  const selectedPhase = phase ?? "phase1";

  const eligibleCandidates = useMemo(() => {
    if (selectedPhase === "phase1") {
      return candidates.filter((candidate) => candidate.phase1Complete && !candidate.disqualified);
    }
    return candidates.filter((candidate) => candidate.promotedToPhase2 && candidate.phase2Complete && !candidate.disqualified);
  }, [candidates, selectedPhase]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 bp-fade-up">
        <p className="bp-label">Results Summary</p>
        <h1 className="mt-3 text-[32px] font-display font-extrabold tracking-tight uppercase">{selectedPhase === "phase1" ? "Phase 1" : "Phase 2"} Results</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Exportable summary of all completed candidate evaluations for the current position.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/results"
          search={{ phase: "phase1" }}
          className={`inline-flex items-center justify-center rounded border-2 px-4 py-3 text-[11px] uppercase tracking-widest bp-press ${selectedPhase === "phase1" ? "border-ink bg-ink text-surface" : "border-ink/40 bg-surface text-ink"}`}
        >
          Phase 1 Summary
        </Link>
        <Link
          to="/results"
          search={{ phase: "phase2" }}
          className={`inline-flex items-center justify-center rounded border-2 px-4 py-3 text-[11px] uppercase tracking-widest bp-press ${selectedPhase === "phase2" ? "border-ink bg-ink text-surface" : "border-ink/40 bg-surface text-ink"}`}
        >
          Phase 2 Summary
        </Link>
      </div>

      <section className="bp-card mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="bp-label">{eligibleCandidates.length} candidates included</p>
            <p className="bp-meta mt-2 text-[12px]">Use the export controls below to print or download the full phase summary.</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded border-2 border-ink bg-surface px-4 py-3 text-[11px] uppercase tracking-widest text-ink bp-press"
          >
            <ArrowLeft className="h-4 w-4" /> Back to pipeline
          </Link>
        </div>
      </section>

      <ResultExportSummary position={activePosition} phase={selectedPhase} candidates={eligibleCandidates} />
    </AppShell>
  );
}
