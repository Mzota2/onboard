import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCandidates } from "@/hooks/use-vetting-data";
import { deleteCandidate, deleteCandidatesByPosition, updateCandidate } from "@/lib/firebase/candidates";
import {
  deletePosition,
  newQuestionId,
  updatePosition,
} from "@/lib/firebase/positions";
import type { Candidate, Position, PositionQuestion, SilhouetteKind } from "@/lib/firebase/types";
import { ScenarioManager } from "./ScenarioManager";

type PhaseKey = "phase1Questions" | "phase2Questions";

const PHASE_LABELS: Record<PhaseKey, string> = {
  phase1Questions: "Phase 1 · Questionnaire",
  phase2Questions: "Phase 2 · Live Interview",
};

const PHASE_OPTIONS = [
  { value: "phase1", label: "Phase 1 Only" },
  { value: "phase2", label: "Phase 2 Only" },
  { value: "both", label: "Both Phases" },
] as const;

export { QuestionManager };

export function AdminPipelinePanel({
  position,
  positions,
  onPositionChange,
}: {
  position: Position;
  positions: Position[];
  onPositionChange?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();
  const { data: candidates = [] } = useCandidates(position.id);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["positions"] }),
      queryClient.invalidateQueries({ queryKey: ["candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["pipeline-stats"] }),
    ]);
  };

  return (
    <section className="bp-fade-up relative mb-6">
      <div className="absolute -right-1 top-2 bottom-2 left-2 border-2 border-ink bg-surface-dim" aria-hidden />
      <div className="bp-card relative p-5 shadow-[6px_6px_0_0_var(--ink)]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <p className="bp-label">Admin Controls</p>
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">Manage Pipeline</h2>
          </div>
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {expanded && (
          <div className="mt-5 space-y-6 border-t-2 border-dashed border-ink/30 pt-5">
            {positions.length > 1 && onPositionChange && (
              <div>
                <p className="bp-label mb-2">Active Position</p>
                <select
                  value={position.id}
                  onChange={(e) => onPositionChange(e.target.value)}
                  className="w-full border-2 border-ink bg-surface px-3 py-2.5 font-mono text-[12px] focus:outline-none"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <PositionEditor position={position} onSaved={invalidate} onDeleted={invalidate} />
            <ScenarioManager position={position} onSaved={invalidate} />
            <CandidateManager candidates={candidates} onSaved={invalidate} />
          </div>
        )}
      </div>
    </section>
  );
}

function PositionEditor({
  position,
  onSaved,
  onDeleted,
}: {
  position: Position;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(position.title);
  const [code, setCode] = useState(position.code);
  const [description, setDescription] = useState(position.description);
  const [status, setStatus] = useState(position.status);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEdit = () => {
    setTitle(position.title);
    setCode(position.code);
    setDescription(position.description);
    setStatus(position.status);
    setEditing(true);
  };

  const save = async () => {
    if (!title.trim() || !code.trim()) {
      toast.error("Title and code are required");
      return;
    }
    setSaving(true);
    try {
      await updatePosition(position.id, {
        title: title.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        status,
      });
      await onSaved();
      toast.success("Position updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update position");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteCandidatesByPosition(position.id);
      await deletePosition(position.id);
      await onDeleted();
      toast.success("Position and its candidates deleted");
      setConfirmDelete(false);
      setEditing(false);
    } catch {
      toast.error("Failed to delete position");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="bp-label">Position Details</p>
        <button type="button" onClick={openEdit} className="flex items-center gap-1 bp-meta underline">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      <div className="border-2 border-ink bg-surface-dim px-3 py-3">
        <p className="font-display font-bold">{position.title}</p>
        <p className="bp-meta mt-1">{position.code} · {position.status}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{position.description}</p>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Edit Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Position title"
              className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Project code"
              className="w-full border-2 border-ink px-3 py-2.5 font-mono focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="min-h-[80px] w-full resize-y border-2 border-ink bg-surface-dim p-3 text-[14px] focus:outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Position["status"])}
              className="w-full border-2 border-ink px-3 py-2.5 font-mono text-[12px] focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-widest text-surface disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full border-2 border-ink py-2 font-mono text-[11px] uppercase tracking-widest text-alert"
            >
              Delete Position
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete position?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {position.code} and all associated candidates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionManager({
  phaseKey,
  position,
  onSaved,
}: {
  phaseKey: PhaseKey;
  position: Position;
  onSaved: () => Promise<void>;
}) {
  // Use new unified questions structure if available, fallback to old structure
  const allQuestions = position.questions || [];
  const phaseFilter = phaseKey === "phase1Questions" ? "phase1" : "phase2";
  const questions = allQuestions.filter(q => q.phase === phaseFilter || q.phase === "both");
  
  const scenarios = position.scenarios || [];
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState<PositionQuestion | null>(null);
  const [prompt, setPrompt] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [phase, setPhase] = useState<"phase1" | "phase2" | "both">("phase1");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PositionQuestion | null>(null);

  const persist = async (next: PositionQuestion[]) => {
    setSaving(true);
    try {
      await updatePosition(position.id, { questions: next });
      await onSaved();
    } catch {
      toast.error("Failed to update questions");
      throw new Error("save failed");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setPrompt("");
    setScenarioId(scenarios[0]?.id || "");
    setPhase(phaseFilter === "phase1" ? "phase1" : "phase2");
    setEditTarget(null);
    setAdding(true);
  };

  const openEdit = (q: PositionQuestion) => {
    setPrompt(q.prompt);
    setScenarioId(q.scenarioId);
    setPhase(q.phase);
    setEditTarget(q);
    setAdding(true);
  };

  const saveQuestion = async () => {
    if (!prompt.trim()) {
      toast.error("Question prompt is required");
      return;
    }
    if (!scenarioId && scenarios.length > 0) {
      toast.error("Please select a scenario");
      return;
    }
    try {
      let next: PositionQuestion[];
      if (editTarget) {
        next = allQuestions.map((q) =>
          q.id === editTarget.id 
            ? { ...q, prompt: prompt.trim(), scenarioId, phase }
            : q,
        );
        toast.success("Question updated");
      } else {
        const maxOrder = Math.max(0, ...allQuestions.map(q => q.order));
        next = [
          ...allQuestions,
          { id: newQuestionId(), prompt: prompt.trim(), scenarioId, phase, order: maxOrder + 1 },
        ];
        toast.success("Question added");
      }
      await persist(next);
      setAdding(false);
    } catch {
      /* toast handled */
    }
  };

  const removeQuestion = async () => {
    if (!deleteTarget) return;
    try {
      const next = allQuestions
        .filter((q) => q.id !== deleteTarget.id)
        .map((q, i) => ({ ...q, order: i + 1 }));
      await persist(next);
      toast.success("Question deleted");
      setDeleteTarget(null);
    } catch {
      /* toast handled */
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="bp-label">{PHASE_LABELS[phaseKey]}</p>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[10px] uppercase tracking-widest bp-press"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="border-2 border-dashed border-ink/40 px-3 py-4 text-center text-[13px] text-muted-foreground">
          {scenarios.length === 0 
            ? "No scenarios yet. Create scenarios first before adding questions."
            : "No questions yet. Add one to get started."}
        </p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => {
            const scenario = scenarios.find(s => s.id === q.scenarioId);
            return (
              <li key={q.id} className="flex items-start gap-2 border-2 border-ink bg-surface px-3 py-2.5">
                <span className="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                  Q{q.order.toString().padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <p className="text-[13px] leading-snug">{q.prompt}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="border border-ink/50 bg-surface-dim px-1.5 py-0.5 text-[10px] font-mono">
                      {scenario?.name || "No scenario"}
                    </span>
                    <span className="bp-meta text-[10px]">
                      {q.phase === "both" ? "Both phases" : q.phase === "phase1" ? "Phase 1" : "Phase 2"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEdit(q)} aria-label="Edit question">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(q)} aria-label="Delete question">
                    <Trash2 className="h-3.5 w-3.5 text-alert" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">
              {editTarget ? "Edit Question" : "Add Question"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the question prompt..."
              className="min-h-[120px] w-full resize-y border-2 border-ink bg-surface-dim p-3 text-[14px] focus:outline-none"
            />
            {scenarios.length > 0 ? (
              <div>
                <p className="bp-label mb-2">Scenario</p>
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                  className="w-full border-2 border-ink bg-surface px-3 py-2.5 font-mono text-[12px] focus:outline-none"
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="border-2 border-dashed border-alert/50 bg-alert/5 px-3 py-2 text-[12px] text-alert">
                No scenarios available. Create scenarios in the Scenarios section first.
              </p>
            )}
            <div>
              <p className="bp-label mb-2">Phase Assignment</p>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as any)}
                className="w-full border-2 border-ink bg-surface px-3 py-2.5 font-mono text-[12px] focus:outline-none"
              >
                {PHASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={saveQuestion}
              disabled={saving}
              className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-widest text-surface disabled:opacity-60"
            >
              {saving ? "Saving..." : editTarget ? "Save Question" : "Add Question"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              Q{deleteTarget?.order.toString().padStart(2, "0")} will be removed from {PHASE_LABELS[phaseKey].toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeQuestion} disabled={saving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CandidateManager({
  candidates,
  onSaved,
}: {
  candidates: Candidate[];
  onSaved: () => Promise<void>;
}) {
  const [editTarget, setEditTarget] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [silhouette, setSilhouette] = useState<SilhouetteKind>("m1");
  const [saving, setSaving] = useState(false);

  const openEdit = (c: Candidate) => {
    setEditTarget(c);
    setName(c.name);
    setCode(c.code);
    setCurrentRole(c.currentRole);
    setSilhouette(c.silhouette);
  };

  const save = async () => {
    if (!editTarget || !name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setSaving(true);
    try {
      await updateCandidate(editTarget.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        currentRole: currentRole.trim() || "Candidate",
        silhouette,
      });
      await onSaved();
      toast.success("Candidate updated");
      setEditTarget(null);
    } catch {
      toast.error("Failed to update candidate");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteCandidate(deleteTarget.id);
      await onSaved();
      toast.success("Candidate deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete candidate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="bp-label mb-3">Candidates ({candidates.length})</p>
      {candidates.length === 0 ? (
        <p className="border-2 border-dashed border-ink/40 px-3 py-4 text-center text-[13px] text-muted-foreground">
          No candidates for this position yet.
        </p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {candidates.map((c) => (
            <li key={c.id} className="flex items-center gap-2 border-2 border-ink px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold">{c.name}</p>
                <p className="bp-meta truncate">{c.code} · {c.currentRole}</p>
              </div>
              <button type="button" onClick={() => openEdit(c)} aria-label="Edit candidate">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setDeleteTarget(c)} aria-label="Delete candidate">
                <Trash2 className="h-3.5 w-3.5 text-alert" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Edit Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Candidate code" className="w-full border-2 border-ink px-3 py-2.5 font-mono focus:outline-none" />
            <input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="Current role" className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />
            <select value={silhouette} onChange={(e) => setSilhouette(e.target.value as SilhouetteKind)} className="w-full border-2 border-ink px-3 py-2.5 font-mono text-[12px] focus:outline-none">
              <option value="m1">Silhouette M1</option>
              <option value="f1">Silhouette F1</option>
              <option value="m2">Silhouette M2</option>
            </select>
          </div>
          <DialogFooter>
            <button type="button" onClick={save} disabled={saving} className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-widest text-surface disabled:opacity-60">
              {saving ? "Saving..." : "Save Candidate"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} ({deleteTarget?.code}) will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AdminCandidateActions({
  candidate,
  onSaved,
}: {
  candidate: Candidate;
  onSaved: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(candidate.name);
  const [code, setCode] = useState(candidate.code);
  const [currentRole, setCurrentRole] = useState(candidate.currentRole);
  const [silhouette, setSilhouette] = useState(candidate.silhouette);
  const [saving, setSaving] = useState(false);

  const promoteToPhase2 = async () => {
    setSaving(true);
    try {
      await updateCandidate(candidate.id, {
        promotedToPhase2: true,
        promotionMethod: "manual",
        status: "phase2",
      });
      await onSaved();
      toast.success("Candidate promoted to Phase 2");
    } catch {
      toast.error("Failed to promote candidate");
    } finally {
      setSaving(false);
    }
  };

  const demoteFromPhase2 = async () => {
    setSaving(true);
    try {
      await updateCandidate(candidate.id, {
        promotedToPhase2: false,
        promotionMethod: null,
        status: "phase1",
      });
      await onSaved();
      toast.success("Candidate removed from Phase 2");
    } catch {
      toast.error("Failed to remove candidate from Phase 2");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateCandidate(candidate.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        currentRole: currentRole.trim(),
        silhouette,
      });
      await onSaved();
      toast.success("Candidate updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update candidate");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteCandidate(candidate.id);
      await onSaved();
      toast.success("Candidate deleted");
      setDeleteOpen(false);
    } catch {
      toast.error("Failed to delete candidate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mt-3 space-y-2">
        {candidate.phase1Complete && (
          <button
            type="button"
            onClick={candidate.promotedToPhase2 ? demoteFromPhase2 : promoteToPhase2}
            disabled={saving}
            className={`flex items-center justify-center gap-1 border-2 py-2 font-mono text-[10px] uppercase tracking-widest bp-press ${
              candidate.promotedToPhase2 
                ? "border-alert text-alert" 
                : "border-ink bg-ink text-surface"
            }`}
          >
            {candidate.promotedToPhase2 ? (
              <>
                <Trash2 className="h-3 w-3" /> Remove from Phase 2
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> Promote to Phase 2
              </>
            )}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setName(candidate.name);
              setCode(candidate.code);
              setCurrentRole(candidate.currentRole);
              setSilhouette(candidate.silhouette);
              setEditOpen(true);
            }}
            className="flex items-center justify-center gap-1 border-2 border-ink py-2 font-mono text-[10px] uppercase tracking-widest bp-press"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex items-center justify-center gap-1 border-2 border-ink py-2 font-mono text-[10px] uppercase tracking-widest text-alert bp-press"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Edit Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full border-2 border-ink px-3 py-2.5 font-mono focus:outline-none" />
            <input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none" />
            <select value={silhouette} onChange={(e) => setSilhouette(e.target.value as SilhouetteKind)} className="w-full border-2 border-ink px-3 py-2.5 font-mono text-[12px]">
              <option value="m1">Silhouette M1</option>
              <option value="f1">Silhouette F1</option>
              <option value="m2">Silhouette M2</option>
            </select>
          </div>
          <button type="button" onClick={save} disabled={saving} className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase text-surface disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {candidate.name} from the pipeline permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={saving}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
