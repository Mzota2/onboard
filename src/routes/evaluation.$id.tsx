import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Loader2 } from "lucide-react";
import { AppShell, ScoreBlocks } from "@/components/AppShell";
import { PortraitSilhouette } from "@/components/PortraitSilhouette";
import { ResultExportActions } from "@/components/ResultExportActions";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getCandidate } from "@/lib/firebase/candidates";
import { listEvaluations } from "@/lib/firebase/evaluations";
import { usePositions } from "@/hooks/use-vetting-data";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/evaluation/$id")({
  beforeLoad: requireAuth,
  head: ({ params }) => ({
    meta: [{ title: `Evaluation · ${params.id} · onboard` }],
  }),
  component: EvalPage,
});

function scorePercent(scores: { technicalDepth: number; clarity: number; impact: number } | null): number {
  if (!scores) return 0;
  return Math.round(((scores.technicalDepth + scores.clarity + scores.impact) / 3) * 20);
}

function EvalPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const { data: positions = [] } = usePositions();
  const activePosition = positions[0];

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate(id),
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["evaluations", id],
    queryFn: () => listEvaluations(id),
    enabled: !!id,
  });

  const canView =
    isAdmin ||
    activePosition?.phase2ConsentReleased ||
    activePosition?.phase1ConsentReleased;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </AppShell>
    );
  }

  if (!candidate) {
    return (
      <AppShell>
        <div className="bp-card p-6 text-center">
          <p className="font-display text-lg font-bold">Candidate not found</p>
          <Link to="/candidate" className="mt-4 inline-block underline bp-meta">Back to pipeline</Link>
        </div>
      </AppShell>
    );
  }

  if (!canView) {
    return (
      <AppShell>
        <div className="bp-card p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8" />
          <p className="mt-3 font-display text-lg font-bold uppercase">Results locked</p>
          <p className="mt-2 text-sm text-muted-foreground">Awaiting admin consent to release evaluation data.</p>
        </div>
      </AppShell>
    );
  }

  const p1 = scorePercent(candidate.phase1Scores);
  const p2 = scorePercent(candidate.phase2Scores);
  const finalScore = candidate.aggregateScore / 10;

  return (
    <AppShell>
      <div className="bp-fade-up">
        <p className="bp-meta">Candidates › Result Archive</p>
        <h1 className="mt-3 font-display text-[28px] leading-tight font-extrabold tracking-tight uppercase">
          {candidate.name}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{candidate.currentRole}</p>
      </div>

      <article className="bp-card-shadow mt-5 p-5 text-center">
        <div className="mx-auto w-fit"><PortraitSilhouette kind={candidate.silhouette} /></div>
        <p className="bp-label mt-4">Aggregate Score</p>
        <p className="font-display text-5xl font-extrabold">{finalScore.toFixed(1)}</p>
        <p className="mt-2 bp-meta">Code: {candidate.code}</p>
      </article>

      <article className="bp-card mt-5 p-5">
        <p className="bp-label mb-4">Phase Breakdown</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="bp-meta mb-1">Phase 1</p>
            <ScoreBlocks value={Math.round(p1 / 20) || 0} />
            <p className="mt-1 font-display font-bold">{p1}%</p>
          </div>
          <div>
            <p className="bp-meta mb-1">Phase 2</p>
            <ScoreBlocks value={Math.round(p2 / 20) || 0} />
            <p className="mt-1 font-display font-bold">{p2 > 0 ? `${p2}%` : "—"}</p>
          </div>
        </div>
        {candidate.phase1Scores?.notes && (
          <div className="mt-4 border-t-2 border-dashed border-ink/30 pt-4">
            <p className="bp-label mb-2">Phase 1 Notes</p>
            <p className="text-sm leading-relaxed">{candidate.phase1Scores.notes}</p>
          </div>
        )}
        {candidate.phase2Scores?.notes && (
          <div className="mt-4 border-t-2 border-dashed border-ink/30 pt-4">
            <p className="bp-label mb-2">Phase 2 Notes</p>
            <p className="text-sm leading-relaxed">{candidate.phase2Scores.notes}</p>
          </div>
        )}
      </article>

      <ResultExportActions
        candidate={candidate}
        position={activePosition}
        phase="final"
        averageScore={finalScore}
        interviewCount={evaluations.filter((evaluation) => evaluation.isComplete).length}
        phaseScores={{ phase1: p1, phase2: p2 }}
      />

      <Link to="/candidate" className="mt-5 block border-2 border-ink bg-ink py-4 text-center font-mono text-[11px] uppercase tracking-widest text-surface bp-press">
        Back to Candidates
      </Link>
    </AppShell>
  );
}
