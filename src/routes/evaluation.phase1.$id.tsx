import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Loader2, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PortraitSilhouette } from "@/components/PortraitSilhouette";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getCandidate } from "@/lib/firebase/candidates";
import { listEvaluations, aggregateCandidateScores } from "@/lib/firebase/evaluations";
import { usePositions } from "@/hooks/use-vetting-data";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/evaluation/phase1/$id")({
  beforeLoad: requireAuth,
  head: ({ params }) => ({
    meta: [{ title: `Phase 1 Evaluation · ${params.id} · onboard` }],
  }),
  component: Phase1EvalPage,
});

function Phase1EvalPage() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const { data: positions = [] } = usePositions();
  const activePosition = positions[0];

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate(id),
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["evaluations", id, "phase1"],
    queryFn: () => listEvaluations(id, "phase1"),
    enabled: !!id,
  });

  const { data: aggregated } = useQuery({
    queryKey: ["aggregated-scores", id, "phase1"],
    queryFn: () => aggregateCandidateScores(id, "phase1"),
    enabled: !!id,
  });

  const canView = isAdmin || activePosition?.phase1ConsentReleased;

  // Prevent viewing evaluations for disqualified candidates
  if (candidate?.disqualified) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="bp-label text-alert">Candidate Disqualified</p>
          <p className="mt-2 text-center text-[13px] text-muted-foreground">
            {candidate.name} has been disqualified and cannot be evaluated.
            {candidate.disqualifiedReason && ` Reason: ${candidate.disqualifiedReason}`}
          </p>
          <Link
            to="/"
            className="mt-4 border-2 border-ink bg-ink px-4 py-3 text-surface bp-press"
          >
            Return to Pipeline
          </Link>
        </div>
      </AppShell>
    );
  }

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

  const scenarios = activePosition?.scenarios || [];
  const allQuestions = activePosition?.questions || [];
  const phase1Questions = allQuestions.filter(q => q.phase === "phase1" || q.phase === "both");
  const completedEvaluations = evaluations.filter(e => e.isComplete);
  const averageScore = aggregated?.averageScore || 0;

  return (
    <AppShell>
      <div className="bp-fade-up">
        <p className="bp-meta">Phase 1 › Questionnaire Evaluation</p>
        <h1 className="mt-3 font-display text-[28px] leading-tight font-extrabold tracking-tight uppercase">
          {candidate.name}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{candidate.currentRole}</p>
      </div>

      <article className="bp-card-shadow mt-5 p-5 text-center">
        <div className="mx-auto w-fit"><PortraitSilhouette kind={candidate.silhouette} /></div>
        <p className="bp-label mt-4">Phase 1 Aggregate Score</p>
        <p className="font-display text-5xl font-extrabold">{averageScore}%</p>
        <p className="mt-2 bp-meta">Based on {completedEvaluations.length} interviewer{completedEvaluations.length !== 1 ? 's' : ''}</p>
        <p className="bp-meta">Code: {candidate.code}</p>
      </article>

      {/* Individual Interviewer Evaluations */}
      {completedEvaluations.length > 0 && (
        <article className="bp-card mt-5 p-5">
          <p className="bp-label mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Interviewer Evaluations</p>
          <div className="space-y-3">
            {completedEvaluations.map((evaluation) => (
              <div key={evaluation.id} className="border-2 border-ink bg-surface-dim p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display text-sm font-bold">{evaluation.interviewerName}</p>
                  <p className="font-mono text-lg font-bold">{evaluation.aggregateScore}%</p>
                </div>
                <p className="bp-meta text-[10px]">Completed: {new Date(evaluation.updatedAt).toLocaleDateString()}</p>
                {evaluation.notes && (
                  <p className="mt-2 text-[13px] italic">"{evaluation.notes}"</p>
                )}
              </div>
            ))}
          </div>
        </article>
      )}

      <article className="bp-card mt-5 p-5">
        <p className="bp-label mb-4">Evaluation Details</p>
        
        {/* Criteria Breakdown from Aggregated Evaluations */}
        {aggregated?.criteriaBreakdown && Object.keys(aggregated.criteriaBreakdown).length > 0 && (
          <div>
            <p className="bp-label mb-3">Aggregated Criteria Scores</p>
            
            {scenarios.length === 0 ? (
              // Fallback for old structure without scenarios
              <div className="space-y-3">
                {Object.entries(aggregated.criteriaBreakdown).map(([criterionId, data]: [string, any]) => (
                  <div key={criterionId} className="flex items-center justify-between border-2 border-ink bg-surface-dim p-3">
                    <div>
                      <p className="font-display text-sm font-bold">{criterionId}</p>
                      <p className="bp-meta text-[11px]">Average score from {data.count} interviewer(s)</p>
                    </div>
                    <p className="font-mono text-lg font-bold">{data.average.toFixed(1)}/5</p>
                  </div>
                ))}
              </div>
            ) : (
              // New structure with scenarios
              scenarios.map((scenario: any) => {
                const scenarioCriteria = scenario.criteria || [];
                const hasScores = scenarioCriteria.some((c: any) => aggregated.criteriaBreakdown[c.id]);
                
                if (!hasScores) return null;
                
                return (
                  <div key={scenario.id} className="mb-4 border-2 border-ink bg-surface-dim p-4 last:mb-0">
                    <p className="font-display text-sm font-bold mb-3">{scenario.name}</p>
                    <p className="bp-meta text-[11px] mb-3">{scenario.description}</p>
                    <div className="space-y-2">
                      {scenarioCriteria.map((criterion: any) => {
                        const scoreData = aggregated.criteriaBreakdown[criterion.id];
                        if (!scoreData) return null;
                        
                        return (
                          <div key={criterion.id} className="flex items-center justify-between border-b border-ink/20 pb-2 last:border-b-0">
                            <div className="flex-1">
                              <p className="font-medium text-[13px]">{criterion.name}</p>
                              <p className="bp-meta text-[10px]">{criterion.description}</p>
                              <p className="bp-meta text-[10px] mt-1">Based on {scoreData.count} interviewer(s)</p>
                            </div>
                            <p className="font-mono font-bold">{scoreData.average.toFixed(1)}/{criterion.scale}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        
        {/* Questions evaluated */}
        {phase1Questions.length > 0 && (
          <div className="mt-4">
            <p className="bp-label mb-3">Questions Evaluated</p>
            <ul className="space-y-2">
              {phase1Questions.map((q: any) => {
                const scenario = scenarios.find((s: any) => s.id === q.scenarioId);
                return (
                  <li key={q.id} className="border-l-2 border-ink pl-3">
                    <p className="text-[13px] font-medium">{q.prompt}</p>
                    {scenario && (
                      <p className="bp-meta text-[10px] mt-1">Scenario: {scenario.name}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/phase1" search={{ candidateId: candidate.id }} className="border-2 border-ink py-4 text-center font-mono text-[11px] uppercase tracking-widest bp-press">
          Back to Phase 1
        </Link>
        <Link to="/candidate" className="border-2 border-ink bg-ink py-4 text-center font-mono text-[11px] uppercase tracking-widest text-surface bp-press">
          All Candidates
        </Link>
      </div>
    </AppShell>
  );
}
