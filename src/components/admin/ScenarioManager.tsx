import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import type { Scenario, Criterion, Position } from "@/lib/firebase/types";
import { updatePosition } from "@/lib/firebase/positions";

export function ScenarioManager({
  position,
  onSaved,
}: {
  position: Position;
  onSaved: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState<Scenario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<Omit<Criterion, "id">[]>([]);
  const [saving, setSaving] = useState(false);

  const scenarios = position.scenarios || [];

  const persist = async (next: Scenario[]) => {
    setSaving(true);
    try {
      await updatePosition(position.id, { scenarios: next });
      await onSaved();
    } catch {
      toast.error("Failed to update scenarios");
      throw new Error("save failed");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setName("");
    setDescription("");
    setCriteria([{ name: "", description: "", scale: 5 }]);
    setEditTarget(null);
    setAdding(true);
  };

  const openEdit = (s: Scenario) => {
    setName(s.name);
    setDescription(s.description);
    setCriteria(s.criteria.map(c => ({ name: c.name, description: c.description, scale: c.scale })));
    setEditTarget(s);
    setAdding(true);
  };

  const addCriterion = () => {
    setCriteria([...criteria, { name: "", description: "", scale: 5 }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: keyof Omit<Criterion, "id">, value: string | number) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const saveScenario = async () => {
    if (!name.trim()) {
      toast.error("Scenario name is required");
      return;
    }
    if (criteria.length === 0 || criteria.some(c => !c.name.trim())) {
      toast.error("At least one criterion with a name is required");
      return;
    }
    try {
      const newCriteria: Criterion[] = criteria.map((c, i) => ({
        id: `crit-${Date.now()}-${i}`,
        name: c.name.trim(),
        description: c.description.trim(),
        scale: c.scale,
      }));
      
      let next: Scenario[];
      if (editTarget) {
        next = scenarios.map((s) =>
          s.id === editTarget.id ? { ...s, name: name.trim(), description: description.trim(), criteria: newCriteria } : s,
        );
        toast.success("Scenario updated");
      } else {
        next = [
          ...scenarios,
          { id: `scenario-${Date.now()}`, name: name.trim(), description: description.trim(), criteria: newCriteria },
        ];
        toast.success("Scenario added");
      }
      await persist(next);
      setAdding(false);
    } catch {
      /* toast handled */
    }
  };

  const removeScenario = async () => {
    if (!deleteTarget) return;
    try {
      const next = scenarios.filter((s) => s.id !== deleteTarget.id);
      await persist(next);
      toast.success("Scenario deleted");
      setDeleteTarget(null);
    } catch {
      /* toast handled */
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="bp-label">Scenarios & Criteria</p>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[10px] uppercase tracking-widest bp-press"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {scenarios.length === 0 ? (
        <p className="border-2 border-dashed border-ink/40 px-3 py-4 text-center text-[13px] text-muted-foreground">
          No scenarios yet. Create scenarios to define evaluation criteria.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-ink/20">
          {scenarios.map((s) => (
            <li key={s.id} className="flex-shrink-0 w-72 border-2 border-ink bg-surface px-3 py-2.5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-bold truncate">{s.name}</p>
                  <p className="bp-meta text-[12px] line-clamp-2">{s.description}</p>
                </div>
                <div className="flex shrink-0 gap-1 ml-2">
                  <button type="button" onClick={() => openEdit(s)} aria-label="Edit scenario">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(s)} aria-label="Delete scenario">
                    <Trash2 className="h-3.5 w-3.5 text-alert" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.criteria.map((c) => (
                  <span key={c.id} className="border border-ink/50 bg-surface-dim px-1.5 py-0.5 text-[10px] font-mono">
                    {c.name}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-2 border-ink sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">
              {editTarget ? "Edit Scenario" : "Add Scenario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Scenario name (e.g., Technical, Communication)"
              className="w-full border-2 border-ink px-3 py-2.5 focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scenario description..."
              className="min-h-[60px] w-full resize-y border-2 border-ink bg-surface-dim p-3 text-[14px] focus:outline-none"
            />
            
            <div className="border-t-2 border-ink/30 pt-3">
              <p className="bp-label mb-2">Evaluation Criteria</p>
              {criteria.map((c, i) => (
                <div key={i} className="mb-3 border-2 border-ink/40 bg-surface-dim/50 p-3">
                  <div className="flex items-start justify-between mb-2">
                    <input
                      value={c.name}
                      onChange={(e) => updateCriterion(i, "name", e.target.value)}
                      placeholder="Criterion name (e.g., Structural Clarity)"
                      className="flex-1 border-2 border-ink px-2 py-1.5 text-[13px] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeCriterion(i)}
                      className="ml-2 text-alert"
                      disabled={criteria.length === 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    value={c.description}
                    onChange={(e) => updateCriterion(i, "description", e.target.value)}
                    placeholder="Criterion description (e.g., Precision of architecture explanation)"
                    className="mb-2 w-full border-2 border-ink px-2 py-1.5 text-[12px] focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="bp-meta text-[11px]">Scale:</span>
                    <select
                      value={c.scale}
                      onChange={(e) => updateCriterion(i, "scale", parseInt(e.target.value))}
                      className="border-2 border-ink px-2 py-1 font-mono text-[11px] focus:outline-none"
                    >
                      <option value={3}>1-3</option>
                      <option value={5}>1-5</option>
                      <option value={7}>1-7</option>
                      <option value={10}>1-10</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCriterion}
                className="flex w-full items-center justify-center gap-1 border-2 border-dashed border-ink py-2 font-mono text-[10px] uppercase tracking-widest bp-press"
              >
                <Plus className="h-3 w-3" /> Add Criterion
              </button>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <button
              type="button"
              onClick={saveScenario}
              disabled={saving}
              className="w-full border-2 border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-widest text-surface disabled:opacity-60"
            >
              {saving ? "Saving..." : editTarget ? "Save Scenario" : "Add Scenario"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} and all its criteria will be removed. Questions using this scenario will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeScenario} disabled={saving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
