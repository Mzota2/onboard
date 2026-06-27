import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";
import type { CreatePositionInput, Position, PositionQuestion, Scenario, UpdatePositionInput } from "./types";

const COLLECTION = "positions";

export const DEFAULT_PHASE1_QUESTIONS: PositionQuestion[] = [
  { id: "p1-q1", prompt: "Describe a distributed system you architected and the trade-offs you made.", order: 1, scenarioId: "", phase: "phase1" },
  { id: "p1-q2", prompt: "How do you evaluate technical debt vs delivery velocity?", order: 2, scenarioId: "", phase: "phase1" },
  { id: "p1-q3", prompt: "Walk through a production incident you led from detection to resolution.", order: 3, scenarioId: "", phase: "phase1" },
];

export const DEFAULT_PHASE2_QUESTIONS: PositionQuestion[] = [
  { id: "p2-q1", prompt: "Design a real-time event pipeline for 10M daily active users.", order: 1, scenarioId: "", phase: "phase2" },
  { id: "p2-q2", prompt: "How would you migrate a monolith to microservices with zero downtime?", order: 2, scenarioId: "", phase: "phase2" },
  { id: "p2-q3", prompt: "Walk through your approach to observability in a multi-region deployment.", order: 3, scenarioId: "", phase: "phase2" },
  { id: "p2-q4", prompt: "Evaluate a candidate's system design under strict latency constraints.", order: 4, scenarioId: "", phase: "phase2" },
];

function normalizeQuestions(items: PositionQuestion[]): PositionQuestion[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((q, i) => ({ ...q, order: i + 1 }));
}

function resolvePhaseQuestions(data: DocumentData): {
  phase1Questions: PositionQuestion[];
  phase2Questions: PositionQuestion[];
  questions: PositionQuestion[];
} {
  // Use new unified questions structure if available
  if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
    const allQuestions = normalizeQuestions(data.questions);
    const phase1Questions = allQuestions.filter(q => q.phase === "phase1" || q.phase === "both");
    const phase2Questions = allQuestions.filter(q => q.phase === "phase2" || q.phase === "both");
    return {
      phase1Questions: phase1Questions.length > 0 ? phase1Questions : DEFAULT_PHASE1_QUESTIONS,
      phase2Questions: phase2Questions.length > 0 ? phase2Questions : DEFAULT_PHASE2_QUESTIONS,
      questions: allQuestions,
    };
  }
  
  // Fallback to legacy structure
  const legacy: PositionQuestion[] = data.questions ?? DEFAULT_PHASE2_QUESTIONS;
  const phase1Questions = normalizeQuestions(
    data.phase1Questions ?? legacy.slice(0, Math.min(3, legacy.length)),
  );
  const phase2Questions = normalizeQuestions(data.phase2Questions ?? legacy);

  return {
    phase1Questions,
    phase2Questions,
    questions: phase2Questions,
  };
}

function mapPosition(id: string, data: DocumentData): Position {
  const { phase1Questions, phase2Questions, questions } = resolvePhaseQuestions(data);
  const scenarios: Scenario[] = data.scenarios ?? [];

  return {
    id,
    title: data.title ?? "",
    code: data.code ?? "",
    description: data.description ?? "",
    status: data.status ?? "active",
    createdBy: data.createdBy ?? "",
    questions,
    phase1Questions,
    phase2Questions,
    scenarios,
    phase1ConsentReleased: data.phase1ConsentReleased ?? false,
    phase2ConsentReleased: data.phase2ConsentReleased ?? false,
    autoPromotion: data.autoPromotion ?? false,
    promotionTopN: data.promotionTopN ?? 3,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function listPositions(): Promise<Position[]> {
  if (!db) return [];
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPosition(d.id, d.data()));
}

export async function getPosition(id: string): Promise<Position | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return mapPosition(snap.id, snap.data());
}

export async function createPosition(input: CreatePositionInput): Promise<Position> {
  if (!db) throw new Error("Firebase is not configured.");

  const phase1Questions = normalizeQuestions(input.questions?.slice(0, 3) ?? DEFAULT_PHASE1_QUESTIONS);
  const phase2Questions = normalizeQuestions(input.questions ?? DEFAULT_PHASE2_QUESTIONS);

  const payload = {
    title: input.title,
    code: input.code,
    description: input.description,
    status: "active",
    createdBy: input.createdBy,
    questions: phase2Questions,
    phase1Questions,
    phase2Questions,
    phase1ConsentReleased: false,
    phase2ConsentReleased: false,
    autoPromotion: false,
    promotionTopN: 3,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return mapPosition(ref.id, { ...payload, createdAt: new Date(), updatedAt: new Date() });
}

export async function updatePosition(id: string, input: UpdatePositionInput): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (input.title !== undefined) payload.title = input.title;
  if (input.code !== undefined) payload.code = input.code;
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) payload.status = input.status;
  if (input.questions !== undefined) {
    payload.questions = normalizeQuestions(input.questions);
  }
  if (input.scenarios !== undefined) {
    payload.scenarios = input.scenarios;
  }
  // Legacy support for old structure
  if ((input as any).phase1Questions !== undefined) {
    payload.phase1Questions = normalizeQuestions((input as any).phase1Questions);
  }
  if ((input as any).phase2Questions !== undefined) {
    payload.phase2Questions = normalizeQuestions((input as any).phase2Questions);
    payload.questions = payload.phase2Questions;
  }

  await updateDoc(doc(db, COLLECTION, id), payload);
}

export async function updatePositionConsent(
  id: string,
  field: "phase1ConsentReleased" | "phase2ConsentReleased",
  value: boolean,
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, COLLECTION, id), { [field]: value, updatedAt: serverTimestamp() });
}

export async function updatePositionPromotionSettings(
  id: string,
  settings: { autoPromotion?: boolean; promotionTopN?: number },
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, COLLECTION, id), { ...settings, updatedAt: serverTimestamp() });
}

export async function deletePosition(id: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, COLLECTION, id));
}

export function newQuestionId(): string {
  return `q-${crypto.randomUUID().slice(0, 8)}`;
}
