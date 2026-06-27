import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownAZ, ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, Toggle } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useCandidates, usePositions } from "@/hooks/use-vetting-data";
import { promoteCandidates } from "@/lib/firebase/candidates";
import { createPosition, updatePositionPromotionSettings } from "@/lib/firebase/positions";
import { requireAdmin } from "@/lib/route-guards";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  positionId: z.string().optional(),
});

export const Route = createFileRoute("/transition")({
  beforeLoad: requireAdmin,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Phase Transition · onboard" }],
  }),
  component: TransitionPage,
});

function scoreFromCandidate(c: { phase1Scores: { technicalDepth: number; clarity: number; impact: number } | null; aggregateScore: number }) {
  if (c.phase1Scores) {
    return Math.round(((c.phase1Scores.technicalDepth + c.phase1Scores.clarity + c.phase1Scores.impact) / 3) * 20);
  }
  return c.aggregateScore;
}

function TransitionPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { positionId: searchPositionId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: positions = [] } = usePositions();
  const activePosition = positions.find((p) => p.id === searchPositionId) ?? positions[0];
  const { data: candidates = [], isLoading } = useCandidates(activePosition?.id);

  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [promoteMap, setPromoteMap] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(!activePosition);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ranked = useMemo(
    () =>
      [...candidates]
        .filter((c) => c.phase1Scores)
        .sort((a, b) => scoreFromCandidate(b) - scoreFromCandidate(a))
        .map((c, i) => ({
          ...c,
          rank: i + 1,
          score: scoreFromCandidate(c),
          promote: promoteMap[c.id] ?? c.promoted,
        })),
    [candidates, promoteMap],
  );

  const selected = ranked.filter((r) => r.promote).length;

  const applyAutoTopN = () => {
    if (!activePosition) return;
    const topN = activePosition.promotionTopN;
    const next: Record<string, boolean> = {};
    ranked.forEach((r, i) => {
      next[r.id] = i < topN;
    });
    setPromoteMap(next);
  };

  const handleCreatePosition = async () => {
    if (!profile || !title.trim() || !code.trim()) {
      toast.error("Title and project code are required");
      return;
    }
    setSubmitting(true);
    try {
      await createPosition({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || "High-fidelity technical vetting position.",
        createdBy: profile.uid,
      });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Position created");
      setShowCreate(false);
      setTitle("");
      setCode("");
      setDescription("");
    } catch {
      toast.error("Failed to create position");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPromotion = async () => {
    const ids = ranked.filter((r) => r.promote).map((r) => r.id);
    if (!ids.length) {
      toast.error("Select at least one candidate to promote");
      return;
    }
    setSubmitting(true);
    try {
      if (activePosition) {
        await updatePositionPromotionSettings(activePosition.id, { autoPromotion: mode === "auto" });
      }
      await promoteCandidates(ids);
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success(`Promoted ${ids.length} candidate(s) to Phase 2`);
      navigate({ to: "/candidate" });
    } catch {
      toast.error("Promotion failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="bp-fade-up">
        <p className="bp-label opacity-70">Administrative Dashboard</p>
        <h1 className="mt-2 font-display text-[34px] leading-[0.95] font-extrabold tracking-tight uppercase">
          Phase<br />Transition
        </h1>
      </div>

      {(showCreate || !activePosition) && (
        <article className="bp-card-shadow my-5 p-5">
          <p className="bp-label mb-3">Create Position</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Senior Solutions Architect"
            className="mb-3 w-full border-2 border-ink bg-surface px-3 py-2.5 text-[15px] focus:outline-none"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SSA-2024-001"
            className="mb-3 w-full border-2 border-ink bg-surface px-3 py-2.5 font-mono text-[14px] focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Position description..."
            className="mb-4 w-full resize-y border-2 border-ink bg-surface-dim p-3 text-[14px] min-h-[80px] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreatePosition}
            disabled={submitting}
            className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-widest text-surface bp-press disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Position"}
          </button>
          {activePosition && (
            <button type="button" onClick={() => setShowCreate(false)} className="mt-2 w-full py-2 bp-meta underline">
              Cancel
            </button>
          )}
        </article>
      )}

      {activePosition && !showCreate && (
        <>
          <button type="button" onClick={() => setShowCreate(true)} className="my-4 bp-meta underline">
            + Create another position
          </button>

          <div className="my-5 grid grid-cols-2 gap-3">
            <div className="bp-card px-4 py-3">
              <p className="bp-meta">Candidates Rated</p>
              <p className="font-display text-3xl font-extrabold">{ranked.length}</p>
            </div>
            <div className="bp-card-shadow-sm bg-ink px-4 py-3 text-surface">
              <p className="font-mono text-[10px] tracking-widest opacity-80">Selected</p>
              <p className="font-display text-3xl font-extrabold">{selected.toString().padStart(2, "0")}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : ranked.length === 0 ? (
            <div className="bp-card p-6 text-center text-muted-foreground">
              No rated Phase 1 candidates yet. Complete questionnaire scoring first.
            </div>
          ) : (
            <article className="bp-card-shadow">
              <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
                <div>
                  <p className="bp-label">Phase 1 · {activePosition.code}</p>
                  <h2 className="font-display text-lg font-extrabold uppercase">Performance Ledger</h2>
                </div>
                <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase">
                  <ArrowDownAZ className="h-3 w-3" /> Score: Desc
                </span>
              </header>

              <div className="grid grid-cols-2 border-b-2 border-ink">
                <div className="flex items-center border-r-2 border-ink px-3 py-3">
                  <span className="bp-label">Promotion Mode</span>
                </div>
                <div className="grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("manual")}
                    className={"py-3 font-mono text-[10px] tracking-widest uppercase border-r-2 border-ink " + (mode === "manual" ? "bg-ink text-surface" : "bg-surface bp-press")}
                  >
                    Manual<br />Selection
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("auto"); applyAutoTopN(); }}
                    className={"py-3 font-mono text-[10px] tracking-widest uppercase " + (mode === "auto" ? "bg-ink text-surface" : "bg-surface bp-press")}
                  >
                    Top Rated<br />(Auto)
                  </button>
                </div>
              </div>

              <ul>
                {ranked.map((r) => (
                  <li key={r.id} className="border-b-2 border-dashed border-ink/40 px-4 py-4 last:border-b-0">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="grid h-9 w-12 place-items-center border-2 border-ink bg-ink font-mono text-[12px] font-bold text-surface">
                        {r.rank.toString().padStart(2, "0")}
                      </span>
                      <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight">{r.name}</h3>
                      <p className="bp-meta">ID: {r.code} <span className="px-1">|</span> {r.currentRole}</p>
                      <p className="bp-label mt-2 opacity-70">Aggregate Score</p>
                      <p className="font-display text-2xl font-extrabold">{r.score} / 100</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="bp-label">Promote</span>
                        <Toggle
                          on={r.promote}
                          onClick={() => setPromoteMap((m) => ({ ...m, [r.id]: !r.promote }))}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {ranked.length > 5 && (
                <div className="flex w-full items-center justify-center gap-2 bg-surface-dim py-3 font-mono text-[11px] tracking-widest uppercase">
                  <ChevronDown className="h-4 w-4" /> {ranked.length - 5} more candidates
                </div>
              )}
            </article>
          )}

          <button
            type="button"
            onClick={handleConfirmPromotion}
            disabled={submitting || !ranked.length}
            className="mt-5 block w-full border-2 border-ink bg-ink px-4 py-5 text-surface bp-press shadow-[6px_6px_0_0_var(--ink)] disabled:opacity-60"
          >
            <p className="text-center font-display text-lg font-extrabold tracking-tight uppercase">Confirm Phase Transition</p>
            <p className="mt-1 text-center font-mono text-[10px] tracking-widest opacity-80">Promote {selected} candidates to phase 2</p>
          </button>
        </>
      )}
    </AppShell>
  );
}
