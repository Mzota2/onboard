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

  const canViewResults = isAdmin || (selectedPhase === "phase1" ? activePosition?.phase1ConsentReleased : activePosition?.phase2ConsentReleased);

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
      <div className="mb-2 bp-fade-up flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-ink/30 bg-surface px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-ink">
            <span className="h-2 w-2 rounded-full bg-ink" /> Results Summary
          </div>
          <h1 className="mt-2 text-[26px] font-display font-extrabold tracking-tight uppercase">{selectedPhase === "phase1" ? "Phase 1" : "Phase 2"} Results</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">Exportable summaries for completed candidate evaluations.</p>
        </div>
        <div className="shrink-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded border-2 border-ink bg-surface px-4 py-2 text-[11px] uppercase tracking-widest text-ink bp-press"
          >
            <ArrowLeft className="h-4 w-4" /> Back to pipeline
          </Link>
        </div>
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

      {!canViewResults ? (
        <section className="bp-card mt-6 p-4">
          <p className="bp-label">Access restricted</p>
          <p className="mt-2 bp-meta">Awaiting admin consent to view {selectedPhase === "phase1" ? "Phase 1" : "Phase 2"} results.</p>
        </section>
      ) : (
        <ResultExportSummary position={activePosition} phase={selectedPhase} candidates={eligibleCandidates} />
      )}
    </AppShell>
  );
}
