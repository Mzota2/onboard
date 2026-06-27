import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Zap, ChevronLeft, ChevronRight, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { AppShell, Toggle } from "@/components/AppShell";
import { AdminCandidateActions } from "@/components/admin/AdminPipelinePanel";
import { PortraitSilhouette } from "@/components/PortraitSilhouette";import { useAuth } from "@/contexts/AuthContext";
import { useCandidates, usePositions } from "@/hooks/use-vetting-data";
import { updatePositionPromotionSettings } from "@/lib/firebase/positions";
import { autoPromoteTopCandidates } from "@/lib/firebase/candidates";
import type { Candidate } from "@/lib/firebase/types";
import { requireAuth } from "@/lib/route-guards";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listEvaluations } from "@/lib/firebase/evaluations";

export const Route = createFileRoute("/candidate")({
  beforeLoad: requireAuth,
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
  const { data: candidates = [], isLoading } = useCandidates(activePosition?.id);
  const queryClient = useQueryClient();
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);

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

  return (
    <AppShell>
      <div className="mb-5 bp-fade-up">
        <p className="bp-meta">{activePosition ? `Project ID: ${activePosition.code}` : "No active position"}</p>
        <h1 className="mt-1 font-display text-[34px] leading-[0.95] font-extrabold tracking-tight uppercase">
          {activePosition?.title ?? "Candidates"}
        </h1>
        <p className="mt-3 border-y-2 border-dashed border-ink/30 py-3 text-center text-[13px] leading-relaxed text-muted-foreground">
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
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button className="bp-card flex items-center justify-center gap-2 py-3 bp-press">
              <Download className="h-4 w-4" />
              <span className="font-mono text-[11px] tracking-widest uppercase">Export Log</span>
            </button>
            <button className="bp-card-shadow-sm text-black flex items-center justify-center gap-2 bg-ink py-3 bp-press">
              <Zap className="h-4 w-4" />
              <span className="text-center text-nowrap font-mono text-[11px] leading-tight tracking-widest uppercase">
                Initiate Vetting
              </span>
            </button>
          </div>

          <div className="mb-3 space-y-3">
            <StatRow label="Active Pipeline" value={`${candidates.length} Candidates`} />
            <StatRow label="Interview Selection" value={`${candidates.filter((c) => c.promoted).length} Selected`} emphasis />
            <StatRow label="Review Pending" value={`${candidates.filter((c) => !c.phase1Scores).length} Profiles`} />
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

          <div className="space-y-5">
            {candidates.map((c, index) => (
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
    <div className={"bp-card flex items-center justify-between px-4 py-3 " + (emphasis ? "bg-ink text-surface" : "")}>
      <span className={"bp-label " + (emphasis ? "text-surface" : "")}>{label}</span>
      <span className="font-display text-lg font-extrabold">{value}</span>
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

  return (
    <article 
      className="bp-card-shadow bp-fade-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <header className="flex items-center justify-between border-b-2 border-ink bg-ink px-3 py-2 text-surface">
        <span className="font-mono text-[11px] tracking-widest">RANK // #{c.rank.toString().padStart(2, "0")}</span>
        {selected ? (
          <span className="font-mono text-[10px] tracking-widest">SELECTED FOR INTERVIEW</span>
        ) : (
          <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest"><Clock className="h-3 w-3" /> AWAITING REVIEW</span>
        )}
      </header>

      <div className="p-4">
        <div className="relative mx-auto w-fit">
          <PortraitSilhouette kind={c.silhouette} />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-ink px-2 py-0.5 font-mono text-[10px] tracking-widest text-surface">{c.code}</span>
        </div>

        <h3 className="mt-5 font-display text-2xl font-extrabold tracking-tight uppercase">{c.name}</h3>
        <p className="mt-1 font-mono text-[12px] text-muted-foreground">Current: {c.currentRole}</p>

        {canViewScores ? (
          <>
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-4 flex w-full items-center justify-center gap-2 border-2 border-dashed border-ink py-2 font-mono text-[10px] uppercase tracking-widest bp-press"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isExpanded ? "Hide Details" : "View Detailed Scores"}
            </button>
            
            {isExpanded && (
              <DetailedScores candidate={c} position={position} />
            )}
          </>
        ) : (
          <p className="mt-4 bp-meta text-muted-foreground">Scores locked — awaiting admin consent</p>
        )}

        <div className="mt-5 space-y-2">
          {c.phase1Complete ? (
            <Link to="/evaluation/phase1/$id" params={{ id: c.id }} className="block border-2 border-ink bg-ink py-3 text-center font-mono text-[11px] tracking-widest uppercase text-surface bp-press">
              View Phase 1 Review
            </Link>
          ) : (
            <Link to="/phase1" search={{ candidateId: c.id }} className="block border-2 border-ink bg-ink py-3 text-center font-mono text-[11px] tracking-widest uppercase text-surface bp-press">
              Start Phase 1
            </Link>
          )}
          
          {c.phase1Complete && c.promotedToPhase2 ? (
            <Link to="/phase2" search={{ candidateId: c.id }} className="block border-2 border-ink bg-ink py-3 text-center font-mono text-[11px] tracking-widest uppercase text-surface bp-press">
              Start Phase 2
            </Link>
          ) : c.phase1Complete && !c.promotedToPhase2 ? (
            <div className="border-2 border-dashed border-ink/40 py-3 text-center font-mono text-[11px] tracking-widest uppercase text-muted-foreground">
              Awaiting Phase 2 Selection
            </div>
          ) : null}
          
          {c.phase2Complete && (
            <Link to="/evaluation/phase2/$id" params={{ id: c.id }} className="block border-2 border-ink bg-ink py-3 text-center font-mono text-[11px] tracking-widest uppercase text-surface bp-press">
              View Phase 2 Review
            </Link>
          )}
          
          {isAdmin && <AdminCandidateActions candidate={c} onSaved={onSaved} />}
        </div>
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
                
                if (!p1Score && !p2Score) return null;
                
                return (
                  <div key={criterion.id} className="flex items-center justify-between text-[12px]">
                    <div className="flex-1">
                      <p className="font-medium">{criterion.name}</p>
                      <p className="bp-meta text-[10px]">{criterion.description}</p>
                    </div>
                    <div className="flex gap-4">
                      {p1Score && (
                        <div className="text-center">
                          <p className="bp-meta text-[10px]">P1</p>
                          <p className="font-mono font-bold">{p1Score}/{criterion.scale}</p>
                        </div>
                      )}
                      {p2Score && (
                        <div className="text-center">
                          <p className="bp-meta text-[10px]">P2</p>
                          <p className="font-mono font-bold">{p2Score}/{criterion.scale}</p>
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
            <span className="font-mono">{p1Criteria?.technicalDepth || "—"}/5</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono">{p2Criteria?.technicalDepth || "—"}/5</span>
          </div>
          
          <p className="font-display text-sm font-bold mt-3">Clarity</p>
          <div className="flex justify-between text-[12px]">
            <span>Phase 1</span>
            <span className="font-mono">{p1Criteria?.clarity || "—"}/5</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono">{p2Criteria?.clarity || "—"}/5</span>
          </div>
          
          <p className="font-display text-sm font-bold mt-3">Impact</p>
          <div className="flex justify-between text-[12px]">
            <span>Phase 1</span>
            <span className="font-mono">{p1Criteria?.impact || "—"}/5</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Phase 2</span>
            <span className="font-mono">{p2Criteria?.impact || "—"}/5</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
