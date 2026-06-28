import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Zap, ChevronLeft, ChevronRight, Clock, Loader2, ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, Toggle } from "@/components/AppShell";
import { AdminCandidateActions } from "@/components/admin/AdminPipelinePanel";
import { PortraitSilhouette } from "@/components/PortraitSilhouette";
import { useAuth } from "@/contexts/AuthContext";
import { useCandidates, usePositions } from "@/hooks/use-vetting-data";
import { updatePositionPromotionSettings } from "@/lib/firebase/positions";
import { autoPromoteTopCandidates } from "@/lib/firebase/candidates";
import type { Candidate } from "@/lib/firebase/types";
import { requireAuth } from "@/lib/route-guards";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listEvaluations } from "@/lib/firebase/evaluations";
import { canStartPhase2Review } from "@/lib/phase2-access";
import { z } from "zod";

const candidateSearchSchema = z.object({
  filter: z.enum(["all", "evaluated", "phase2", "disqualified", "pending"]).optional(),
});

export const Route = createFileRoute("/candidate")({
  beforeLoad: requireAuth,
  validateSearch: candidateSearchSchema,
  head: () => ({
    meta: [
      { title: "Candidates · onboard" },
      { name: "description", content: "Ranked candidate pipeline with structured assessment scores." },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { isAdmin } = useAuth();
  const { data: positions = [] } = usePositions();
  const activePosition = positions[0];
  const { filter: queryFilter } = Route.useSearch();
  const { data: candidates = [], isLoading } = useCandidates(activePosition?.id);
  const queryClient = useQueryClient();
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "evaluated" | "phase2" | "disqualified" | "pending">(
    queryFilter ?? "all",
  );

  useEffect(() => {
    if (queryFilter) {
      setFilter(queryFilter);
    }
  }, [queryFilter]);

  const toggleAutoSelect = async () => {
    if (!activePosition || !isAdmin) return;
    try {
      await updatePositionPromotionSettings(activePosition.id, {
        autoPromotion: !activePosition.autoPromotion,
      });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
    } catch {
      toast.error("Failed to update auto-selection");
    }
  };

  const runAutoPromotion = async () => {
    if (!activePosition || !isAdmin) return;
    try {
      await autoPromoteTopCandidates(activePosition.id, activePosition.promotionTopN);
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success(`Top ${activePosition.promotionTopN} candidates promoted to Phase 2`);
    } catch {
      toast.error("Failed to auto-promote candidates");
    }
  };

  const canViewScores = isAdmin || activePosition?.phase1ConsentReleased;

  // Filter candidates based on selected filter
  const filteredCandidates = candidates.filter((c) => {
    switch (filter) {
      case "evaluated":
        return c.phase1Complete && !c.disqualified;
      case "phase2":
        return c.promotedToPhase2 && !c.disqualified;
      case "disqualified":
        return c.disqualified;
      case "pending":
        return !c.phase1Complete && !c.disqualified;
      default:
        return !c.disqualified;
    }
  });

  return (
    <AppShell>
      <div className="mb-4 bp-fade-up">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight uppercase">
            {activePosition?.title ?? "Candidates"}
          </h1>
          {activePosition && (
            <span className="bp-meta text-[11px]">{activePosition.code}</span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {activePosition?.description ?? "Create a position from the pipeline to begin tracking candidates."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="bp-card p-6 text-center">
          <p className="font-display text-lg font-bold uppercase">No candidates yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Add candidates through Phase 1 questionnaire.</p>
          <Link to="/phase1" className="mt-4 inline-block border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-surface">
            Go to Phase 1
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <StatRow label="Active Pipeline" value={`${candidates.length}`} />
            <StatRow label="Review Pending" value={`${candidates.filter((c) => !c.phase1Scores).length}`} />
          </div>

          {isAdmin && activePosition && (
            <div className="bp-card mb-6 flex items-center justify-between px-4 py-3">
              <div>
                <p className="bp-label">Auto-Selection</p>
                <p className="bp-meta mt-1">Top {activePosition.promotionTopN} by Phase 1 score</p>
              </div>
              <div className="flex items-center gap-3">
                <Toggle on={activePosition.autoPromotion} onClick={toggleAutoSelect} label="Auto select" />
                <button
                  type="button"
                  onClick={runAutoPromotion}
                  className="border-2 border-ink bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-surface bp-press"
                >
                  Run Now
                </button>
              </div>
            </div>
          )}

          {/* Filter controls */}
          <div className="sticky top-15 z-10 mb-6 bg-surface py-2">
            <div className="flex items-center justify-between mb-3">
              <p className="bp-label flex items-center gap-2"><Filter className="h-3 w-3" /> Filter Candidates</p>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink bp-press"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-ink/20">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "evaluated", label: "Evaluated" },
                { value: "phase2", label: "Phase 2" },
                { value: "disqualified", label: "Disqualified" },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value as any)}
                  className={`shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border-2 bp-press ${
                    filter === f.value
                      ? "border-ink bg-ink text-surface"
                      : "border-ink/40 bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-2 bp-meta text-[11px]">
              Showing {filteredCandidates.length} of {candidates.length} candidates
            </p>
          </div>

          <div className="space-y-5">
            {filteredCandidates.map((c, index) => (
              <CandidateCard
                key={c.id}
                c={c}
                position={activePosition}
                canViewScores={!!canViewScores}
                isAdmin={isAdmin}
                isExpanded={expandedCandidate === c.id}
                onToggleExpand={() => setExpandedCandidate(expandedCandidate === c.id ? null : c.id)}
                onSaved={async () => {
                  await queryClient.invalidateQueries({ queryKey: ["candidates"] });
                  await queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] });
                }}
                animationDelay={index * 50}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="bp-meta">Showing {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</p>
            <div className="flex">
              <button className="grid h-9 w-9 place-items-center border-2 border-ink bg-surface bp-press"><ChevronLeft className="h-4 w-4" /></button>
              <button className="grid h-9 w-9 place-items-center border-2 border-l-0 border-ink bg-surface bp-press"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={"bp-card flex items-center justify-between px-3 py-2 " + (emphasis ? "bg-ink text-surface" : "")}>
      <span className={"bp-label text-[10px] " + (emphasis ? "text-surface" : "")}>{label}</span>
      <span className="font-display text-base font-extrabold">{value}</span>
    </div>
  );
}

function CandidateCard({
  c,
  position,
  canViewScores,
  isAdmin,
  isExpanded,
  onToggleExpand,
  onSaved,
  animationDelay = 0,
}: {
  c: Candidate;
  position?: any;
  canViewScores: boolean;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaved: () => Promise<void>;
  animationDelay?: number;
}) {
  const selected = c.promoted || c.status === "phase2";
  const canAccessPhase2 = canStartPhase2Review({
    promotedToPhase2: c.promotedToPhase2,
    phase1ConsentReleased: position?.phase1ConsentReleased,
  });

  // Determine primary action
  const getPrimaryAction = () => {
    if (c.disqualified) {
      return (
        <div className="border-2 border-dashed border-alert/50 bg-alert/5 px-3 py-2 text-center">
          <p className="font-mono text-[10px] uppercase text-alert">Disqualified</p>
        </div>
      );
    }
    if (c.phase2Complete) {
      return (
        <Link to="/evaluation/phase2/$id" params={{ id: c.id }} className="block border-2 border-ink bg-ink px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-surface bp-press">
          View Phase 2 Review
        </Link>
      );
    }
    if (c.promotedToPhase2) {
      if (canAccessPhase2) {
        return (
          <Link to="/phase2" search={{ candidateId: c.id }} className="block border-2 border-ink bg-ink px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-surface bp-press">
            Start Phase 2
          </Link>
        );
      }
      return (
        <div className="border-2 border-dashed border-ink/30 bg-surface-dim px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Awaiting Phase 1 Release
        </div>
      );
    }
    if (c.phase1Complete) {
      return (
        <Link to="/evaluation/phase1/$id" params={{ id: c.id }} className="block border-2 border-ink bg-ink px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-surface bp-press">
          View Phase 1 Review
        </Link>
      );
    }
    return (
      <Link to="/phase1" search={{ candidateId: c.id }} className="block border-2 border-ink bg-ink px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-surface bp-press">
        Start Phase 1
      </Link>
    );
  };

  return (
    <article
      className={`bp-card-shadow bp-fade-up ${c.disqualified ? "opacity-60" : ""}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Compact silhouette */}
        <div className="relative shrink-0">
          <PortraitSilhouette kind={c.silhouette} className="h-16 w-16" />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-ink px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-surface">{c.code}</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-extrabold tracking-tight uppercase truncate">{c.name}</h3>
              <p className="font-mono text-[11px] text-muted-foreground truncate">{c.currentRole}</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
              c.disqualified ? "bg-alert text-surface" : selected ? "bg-ink text-surface" : "bg-surface-dim text-ink border border-ink"
            }`}>
              #{c.rank}
            </span>
          </div>

          {/* Status indicator */}
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            {c.disqualified ? (
              <span className="text-alert font-medium">Disqualified</span>
            ) : selected ? (
              <span className="text-ink font-medium">Selected for Interview</span>
            ) : c.phase1Complete ? (
              <span className="text-muted-foreground">Phase 1 Complete</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> Awaiting Review</span>
            )}
          </div>
        </div>
      </div>

      {/* Primary action */}
      <div className="px-4 pb-3">
        {getPrimaryAction()}
      </div>

      {/* Expandable section */}
      <div className="border-t-2 border-ink/20">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-surface-dim bp-press"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isExpanded ? "Show Less" : "More Options"}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* All phase actions */}
            {!c.disqualified && (
              <div className="space-y-2">
                {!c.phase1Complete && (
                  <Link to="/phase1" search={{ candidateId: c.id }} className="block border-2 border-ink/40 py-2 text-center font-mono text-[10px] uppercase tracking-widest bp-press">
                    Start Phase 1
                  </Link>
                )}
                {c.phase1Complete && (
                  <Link to="/evaluation/phase1/$id" params={{ id: c.id }} className="block border-2 border-ink/40 py-2 text-center font-mono text-[10px] uppercase tracking-widest bp-press">
                    View Phase 1 Review
                  </Link>
                )}
                {c.phase1Complete && c.promotedToPhase2 && (
                  canAccessPhase2 ? (
                    <Link to="/phase2" search={{ candidateId: c.id }} className="block border-2 border-ink/40 py-2 text-center font-mono text-[10px] uppercase tracking-widest bp-press">
                      Start Phase 2
                    </Link>
                  ) : (
                    <div className="border-2 border-dashed border-ink/30 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Awaiting Phase 1 Release
                    </div>
                  )
                )}
                {c.phase1Complete && !c.promotedToPhase2 && (
                  <div className="border-2 border-dashed border-ink/30 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Awaiting Phase 2 Selection
                  </div>
                )}
                {c.phase2Complete && (
                  <Link to="/evaluation/phase2/$id" params={{ id: c.id }} className="block border-2 border-ink/40 py-2 text-center font-mono text-[10px] uppercase tracking-widest bp-press">
                    View Phase 2 Review
                  </Link>
                )}
              </div>
            )}

            {/* Disqualification reason */}
            {c.disqualified && c.disqualifiedReason && (
              <div className="border-2 border-dashed border-alert/30 bg-alert/5 p-3">
                <p className="font-mono text-[10px] uppercase text-alert mb-1">Reason</p>
                <p className="text-[12px] text-muted-foreground">{c.disqualifiedReason}</p>
              </div>
            )}

            {/* Detailed scores */}
            {canViewScores && !c.disqualified && (
              <DetailedScores candidate={c} position={position} />
            )}

            {/* Admin actions */}
            {isAdmin && <AdminCandidateActions candidate={c} onSaved={onSaved} />}
          </div>
        )}
      </div>
    </article>
  );
}

function DetailedScores({ candidate, position }: { candidate: Candidate; position?: any }) {
  const { data: phase1Evaluations = [] } = useQuery({
    queryKey: ["evaluations", candidate.id, "phase1"],
    queryFn: () => listEvaluations(candidate.id, "phase1"),
    enabled: !!candidate.id,
  });
  
  const { data: phase2Evaluations = [] } = useQuery({
    queryKey: ["evaluations", candidate.id, "phase2"],
    queryFn: () => listEvaluations(candidate.id, "phase2"),
    enabled: !!candidate.id,
  });

  const scenarios = position?.scenarios || [];
  
  const hasEvaluations = phase1Evaluations.length > 0 || phase2Evaluations.length > 0;

  if (!hasEvaluations) {
    return (
      <div className="mt-4 border-2 border-dashed border-ink/40 bg-surface-dim/50 p-4 text-center text-[13px] text-muted-foreground">
        No detailed scores available yet.
      </div>
    );
  }

  // Aggregate criteria scores from evaluations
  const aggregateCriteriaScores = (evaluations: any[]) => {
    const aggregated: Record<string, { total: number; count: number }> = {};
    
    evaluations.forEach(evaluation => {
      Object.values(evaluation.questionScores || {}).forEach((questionScore: any) => {
        const criteria = questionScore.criteria?.criteria || {};
        Object.entries(criteria).forEach(([criterionId, score]) => {
          if (!aggregated[criterionId]) {
            aggregated[criterionId] = { total: 0, count: 0 };
          }
          aggregated[criterionId].total += (score as number);
          aggregated[criterionId].count += 1;
        });
      });
    });
    
    const result: Record<string, number> = {};
    Object.entries(aggregated).forEach(([id, data]) => {
      result[id] = data.count > 0 ? data.total / data.count : 0;
    });
    
    return result;
  };

  function fmtScore(v: any) {
    if (typeof v !== "number" || !Number.isFinite(v)) return "—";
    return v.toFixed(1);
  }

  function fmtRawScore(v: any) {
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    return `${v.toFixed(6)} raw`;
 }

  const p1Criteria = aggregateCriteriaScores(phase1Evaluations);
  const p2Criteria = aggregateCriteriaScores(phase2Evaluations);

  return (
    <div className="mt-4 space-y-4 border-2 border-ink bg-surface-dim p-4">
      <p className="bp-label mb-3">Detailed Criteria Breakdown</p>
      
      {scenarios.map((scenario: any) => {
        const scenarioCriteria = scenario.criteria || [];
        if (scenarioCriteria.length === 0) return null;
        
        return (
          <div key={scenario.id} className="border-b-2 border-ink/30 pb-3 last:border-b-0 last:pb-0">
            <p className="font-display text-sm font-bold mb-2">{scenario.name}</p>
            <div className="space-y-2">
              {scenarioCriteria.map((criterion: any) => {
                const p1Score = p1Criteria?.[criterion.id];
                const p2Score = p2Criteria?.[criterion.id];
                
                if ((p1Score === null || p1Score === undefined) && (p2Score === null || p2Score === undefined)) return null;
                
                return (
                  <div key={criterion.id} className="flex items-center justify-between text-[12px]">
                    <div className="flex-1">
                      <p className="font-medium">{criterion.name}</p>
                      <p className="bp-meta text-[10px]">{criterion.description}</p>
                    </div>
                    <div className="flex gap-4">
                      {p1Score !== null && p1Score !== undefined && (
                        <div className="text-center">
                          <p className="bp-meta text-[10px]">P1</p>
                          <p className="font-mono font-bold" title={fmtRawScore(p1Score)}>
                            {fmtScore(p1Score)}/{criterion.scale}
                          </p>
                        </div>
                      )}
                      {p2Score !== null && p2Score !== undefined && (
                        <div className="text-center">
                          <p className="bp-meta text-[10px]">P2</p>
                          <p className="font-mono font-bold" title={fmtRawScore(p2Score)}>
                            {fmtScore(p2Score)}/{criterion.scale}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {/* Fallback for old structure without scenarios */}
      {!scenarios || scenarios.length === 0 ? (
        <div className="space-y-2">
          <p className="font-display text-sm font-bold">Technical Depth</p>
          <div className="flex justify-between text-[12px]">
            <span>Phase 1</span>
            <span className="font-mono" title={fmtRawScore(p1Criteria?.technicalDepth)}>
              {p1Criteria?.technicalDepth !== undefined ? fmtScore(p1Criteria.technicalDepth) : "—"}/5
            </span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono" title={fmtRawScore(p2Criteria?.technicalDepth)}>
              {p2Criteria?.technicalDepth !== undefined ? fmtScore(p2Criteria.technicalDepth) : "—"}/5
            </span>
          </div>
          
          <p className="font-display text-sm font-bold mt-3">Clarity</p>
          <div className="flex justify-between text-[12px]">
            <span>Phase 1</span>
            <span className="font-mono" title={fmtRawScore(p1Criteria?.clarity)}>
              {p1Criteria?.clarity !== undefined ? fmtScore(p1Criteria.clarity) : "—"}/5
            </span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono" title={fmtRawScore(p2Criteria?.clarity)}>
              {p2Criteria?.clarity !== undefined ? fmtScore(p2Criteria.clarity) : "—"}/5
            </span>
          </div>
          
          <p className="font-display text-sm font-bold mt-3">Impact</p>
          <div className="flex justify-between text-[12px]">
            <span>Phase 1</span>
            <span className="font-mono" title={fmtRawScore(p1Criteria?.impact)}>
              {p1Criteria?.impact !== undefined ? fmtScore(p1Criteria.impact) : "—"}/5
            </span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono" title={fmtRawScore(p2Criteria?.impact)}>
              {p2Criteria?.impact !== undefined ? fmtScore(p2Criteria.impact) : "—"}/5
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
