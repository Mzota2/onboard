export interface EvaluationDraftQuestionScore {
  criteria: Record<string, number>;
  notes: string;
}

export interface EvaluationDraftState {
  notes: string;
  ratings: Record<string, number>;
  questionScores: Record<string, EvaluationDraftQuestionScore>;
  activeQuestion?: number;
  activeTab?: string;
  updatedAt: number;
}

const STORAGE_PREFIX = "onboard:evaluation-draft";

export function getEvaluationDraftKey(options: {
  phase: "phase1" | "phase2";
  positionId?: string;
  interviewerId?: string;
  candidateId?: string;
}): string | null {
  if (!options.phase || !options.positionId || !options.interviewerId || !options.candidateId) {
    return null;
  }

  return [STORAGE_PREFIX, options.phase, options.positionId, options.interviewerId, options.candidateId].join(":");
}

export function loadEvaluationDraft(key: string | null): EvaluationDraftState | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EvaluationDraftState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEvaluationDraft(key: string | null, draft: EvaluationDraftState): void {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {
    // Ignore storage failures so the app still works offline.
  }
}

export function clearEvaluationDraft(key: string | null): void {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}
