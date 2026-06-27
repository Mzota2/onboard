import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Plus, ArrowRight, Lock, Loader2, Settings as SettingsIcon } from "lucide-react";
import { AppShell, ScoreBlocks, Toggle } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { usePipelineStats, usePositions } from "@/hooks/use-vetting-data";
import { updatePositionConsent } from "@/lib/firebase/positions";
import { requireAuth } from "@/lib/route-guards";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPhaseReleaseReadiness } from "@/lib/firebase/admin";

export const Route = createFileRoute("/")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Pipeline · onboard" },
      { name: "description", content: "High-precision technical vetting pipeline. Multi-phase candidate evaluation with admin governance." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { profile, isAdmin } = useAuth();
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
  const { data: stats, isLoading: statsLoading } = usePipelineStats();
  const queryClient = useQueryClient();
  const activePosition = positions[0];
  const [releaseSummary, setReleaseSummary] = useState<{ phase1: any; phase2: any }>({ phase1: null, phase2: null });

  const toggleConsent = async (field: "phase1ConsentReleased" | "phase2ConsentReleased", value: boolean) => {
    if (!isAdmin || !activePosition) return;

    if (value) {
      const summary = await getPhaseReleaseReadiness(activePosition.id, field);
      if (!summary.canRelease) {
        toast.error(summary.reason);
        return;
      }
    }

    try {
      await updatePositionConsent(activePosition.id, field, value);
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success(value ? "Results released to interviewers" : "Results locked");
    } catch {
      toast.error("Failed to update consent gate");
    }
  };

  useEffect(() => {
    const loadReadiness = async () => {
      if (!activePosition || !isAdmin) return;
      const [phase1, phase2] = await Promise.all([
        getPhaseReleaseReadiness(activePosition.id, "phase1ConsentReleased"),
        getPhaseReleaseReadiness(activePosition.id, "phase2ConsentReleased"),
      ]);
      setReleaseSummary({ phase1, phase2 });
    };

    loadReadiness();
  }, [activePosition?.id, isAdmin]);

  const loading = positionsLoading || statsLoading;

  return (
    <AppShell>
      <div className="mb-4 bp-fade-up">
        <p className="bp-label opacity-70">Welcome back</p>
        <p className="font-display text-lg font-bold">{profile?.displayName}</p>
        <p className="bp-meta capitalize">{profile?.role} · {activePosition?.code ?? "No active position"}</p>
      </div>

      {activePosition && (
        <section className="mb-6 bp-fade-up">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="bp-label">Released results</p>
              <p className="bp-meta mt-2">Quick access to published phase result archives.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {activePosition.phase1ConsentReleased || isAdmin ? (
                <Link
                  to="/results"
                  search={{ phase: "phase1" }}
                  className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-ink px-4 py-3 text-[11px] uppercase tracking-widest text-surface bp-press"
                >
                  Phase 1 Results
                </Link>
              ) : (
                <div className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded border-2 border-ink/40 bg-surface px-4 py-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Phase 1 Results
                </div>
              )}
              {activePosition.phase2ConsentReleased || isAdmin ? (
                <Link
                  to="/results"
                  search={{ phase: "phase2" }}
                  className="inline-flex items-center justify-center gap-2 rounded border-2 border-ink bg-ink px-4 py-3 text-[11px] uppercase tracking-widest text-surface bp-press"
                >
                  Phase 2 Results
                </Link>
              ) : (
                <div className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded border-2 border-ink/40 bg-surface px-4 py-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Phase 2 Results
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="bp-fade-up relative mb-6">
        <div className="absolute -right-1 top-2 bottom-2 left-2 border-2 border-ink bg-surface-dim" aria-hidden />
        <div className="bp-card relative p-5 shadow-[6px_6px_0_0_var(--ink)]">
          <h2 className="bp-label mb-4">Management</h2>
          <Link
            to="/phase1"
            search={activePosition ? { positionId: activePosition.id } : undefined}
            className="mb-3 flex items-center justify-between border-2 border-ink bg-ink px-4 py-3 text-surface bp-press"
          >
            <span className="font-mono text-[12px] tracking-widest uppercase">Add Candidate</span>
            <UserPlus className="h-4 w-4" />
          </Link>
          {isAdmin ? (
            <>
              <Link
                to="/transition"
                search={activePosition ? { positionId: activePosition.id } : undefined}
                className="mb-3 flex items-center justify-between border-2 border-ink bg-surface px-4 py-3 bp-press"
              >
                <span className="font-mono text-[12px] tracking-widest uppercase">Create Position</span>
                <Plus className="h-4 w-4" />
              </Link>
              <Link
                to="/admin"
                className="flex items-center justify-between border-2 border-ink bg-surface px-4 py-3 bp-press"
              >
                <span className="font-mono text-[12px] tracking-widest uppercase">Admin Controls</span>
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <div className="border-2 border-dashed border-ink/40 px-4 py-3 text-[13px] text-muted-foreground">
              Admin access required to create positions.
            </div>
          )}
        </div>
      </section>

      <section className="bp-card mb-6 p-5">
        <SystemIllustration />
        {isAdmin && activePosition && (
          <div className="mt-4 grid gap-2 border-t-2 border-dashed border-ink/40 pt-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="bp-meta">Phase 1 release readiness</span>
              <span className={releaseSummary.phase1?.canRelease ? "text-ink" : "text-alert"}>
                {releaseSummary.phase1?.completedInterviewerCount ?? 0}/{releaseSummary.phase1?.requiredInterviewerCount ?? 0} complete
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="bp-meta">Phase 2 release readiness</span>
              <span className={releaseSummary.phase2?.canRelease ? "text-ink" : "text-alert"}>
                {releaseSummary.phase2?.completedInterviewerCount ?? 0}/{releaseSummary.phase2?.requiredInterviewerCount ?? 0} complete
              </span>
            </div>
          </div>
        )}
        <div className="mt-3 text-center">
          <p className="bp-meta">
            ACTIVE POSITIONS: <span className="font-bold text-ink">{positions.length}</span>
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {activePosition
              ? `Tracking ${activePosition.title}. Consent gates enforce admin governance over result visibility.`
              : "Create a position to begin vetting candidates through Phase 1 and Phase 2."}
          </p>
        </div>
      </section>

      <h1 className="mb-5 text-[44px] leading-[0.95] font-extrabold tracking-tight uppercase">
        Active<br />Recruitment<br />Pipeline
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          <PhaseCard
            phase="01"
            name="Questionnaire"
            questionCount={activePosition?.phase1Questions.length ?? 0}
            candidates={stats?.phase1Count ?? 0}
            pending={stats?.phase1Pending ?? 0}
            avgScore={stats?.phase1AvgScore ?? 0}
            consent={activePosition?.phase1ConsentReleased ?? false}
            onToggle={isAdmin ? () => toggleConsent("phase1ConsentReleased", !activePosition?.phase1ConsentReleased) : undefined}
            href="/phase1"
            locked={!isAdmin && !(activePosition?.phase1ConsentReleased ?? false)}
          />
          <PhaseCard
            phase="02"
            name="Interview"
            questionCount={activePosition?.phase2Questions.length ?? 0}
            candidates={stats?.phase2Count ?? 0}
            pending={stats?.phase2Pending ?? 0}
            avgScore={stats?.phase2AvgScore ?? 0}
            consent={activePosition?.phase2ConsentReleased ?? false}
            onToggle={isAdmin ? () => toggleConsent("phase2ConsentReleased", !activePosition?.phase2ConsentReleased) : undefined}
            href="/phase2"
            locked={!isAdmin && !(activePosition?.phase2ConsentReleased ?? false)}
          />
        </div>
      )}

      <div className="mt-6 border-2 border-dashed border-ink/60 bg-surface-dim/60 px-3 py-2">
        <p className="bp-meta flex items-center gap-2">
          <Lock className="h-3 w-3" /> Final selection phase locked until admin consent
        </p>
      </div>
    </AppShell>
  );
}

function PhaseCard({
  phase, name, questionCount, candidates, pending, avgScore, consent, onToggle, href, locked,
}: {
  phase: string; name: string; questionCount?: number; candidates: number; pending: number; avgScore: number;
  consent: boolean; onToggle?: () => void; href: string; locked?: boolean;
}) {
  const content = (
    <article className={"bp-card relative p-5 shadow-[6px_6px_0_0_var(--ink)] " + (locked ? "opacity-60" : "bp-press")}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="bp-label opacity-70">Phase {phase}</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold tracking-tight uppercase">{name}</h3>
        </div>
        {!locked && <ArrowRight className="h-5 w-5" />}
      </div>

      {onToggle && (
        <div
          className="mb-4 flex items-center justify-between border-y-2 border-dashed border-ink/40 py-2.5"
          onClick={(e) => e.preventDefault()}
        >
          <span className="bp-label leading-tight max-w-[120px]">Admin Consent<br />Required</span>
          <Toggle on={consent} onClick={onToggle} label="Consent" />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-y-3 gap-x-4">
        <div>
          <dt className="bp-meta">Questions</dt>
          <dd className="font-display text-2xl font-extrabold">{questionCount ?? 0}</dd>
        </div>
        <div>
          <dt className="bp-meta">Candidates</dt>
          <dd className="font-display text-2xl font-extrabold">{candidates}</dd>
        </div>
        <div>
          <dt className="bp-meta">Pending Review</dt>
          <dd className={"font-display text-2xl font-extrabold " + (pending > 5 ? "text-[oklch(0.55_0.22_27)]" : "")}>
            {pending.toString().padStart(2, "0")}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="bp-meta mb-1">Avg. Score</dt>
          <dd>{avgScore > 0 ? <ScoreBlocks value={avgScore} /> : <span className="bp-meta">—</span>}</dd>
        </div>
      </dl>
      {locked && <p className="mt-3 bp-meta text-alert">Awaiting admin consent to view results</p>}
    </article>
  );

  if (locked) {
    return <div className="block relative">{content}</div>;
  }

  return (
    <Link to={href} className="block relative">
      <div className="absolute -left-2 top-2 bottom-2 right-3 border-2 border-ink bg-surface-dim" aria-hidden />
      {content}
    </Link>
  );
}

function SystemIllustration() {
  return (
    <svg viewBox="0 0 200 80" className="mx-auto h-20 w-full max-w-[220px]" stroke="currentColor" fill="none" strokeWidth="2">
      <line x1="10" y1="62" x2="190" y2="62" />
      <line x1="30" y1="62" x2="30" y2="74" />
      <line x1="170" y1="62" x2="170" y2="74" />
      <circle cx="70" cy="28" r="8" />
      <path d="M58 62 L58 48 Q70 38 82 48 L82 62" />
      <circle cx="130" cy="28" r="8" />
      <path d="M118 62 L118 48 Q130 38 142 48 L142 62" />
      <line x1="78" y1="36" x2="118" y2="48" />
      <rect x="92" y="52" width="16" height="10" />
    </svg>
  );
}
