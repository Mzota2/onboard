import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";
import type { Evaluation, QuestionScore } from "./types";

const COLLECTION = "evaluations";

function mapEvaluation(id: string, data: DocumentData): Evaluation {
  return {
    id,
    candidateId: data.candidateId ?? "",
    positionId: data.positionId ?? "",
    interviewerId: data.interviewerId ?? "",
    interviewerName: data.interviewerName ?? "",
    phase: data.phase ?? "phase1",
    questionScores: data.questionScores ?? {},
    aggregateScore: data.aggregateScore ?? 0,
    isComplete: data.isComplete ?? false,
    lastQuestionIndex: data.lastQuestionIndex ?? 0,
    notes: data.notes,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function listEvaluations(candidateId?: string, phase?: "phase1" | "phase2"): Promise<Evaluation[]> {
  if (!db) return [];

  let q = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
  
  if (candidateId) {
    q = query(collection(db, COLLECTION), where("candidateId", "==", candidateId), orderBy("updatedAt", "desc"));
  }
  
  if (phase) {
    q = query(collection(db, COLLECTION), where("phase", "==", phase), orderBy("updatedAt", "desc"));
  }

  if (candidateId && phase) {
    q = query(collection(db, COLLECTION), where("candidateId", "==", candidateId), where("phase", "==", phase), orderBy("updatedAt", "desc"));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvaluation(d.id, d.data()));
}

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return mapEvaluation(snap.id, snap.data());
}

export async function getInterviewerEvaluation(
  candidateId: string,
  interviewerId: string,
  phase: "phase1" | "phase2",
): Promise<Evaluation | null> {
  if (!db) return null;
  const q = query(
    collection(db, COLLECTION),
    where("candidateId", "==", candidateId),
    where("interviewerId", "==", interviewerId),
    where("phase", "==", phase),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapEvaluation(snap.docs[0].id, snap.docs[0].data());
}

export async function createEvaluation(input: {
  candidateId: string;
  positionId: string;
  interviewerId: string;
  interviewerName: string;
  phase: "phase1" | "phase2";
}): Promise<Evaluation> {
  if (!db) throw new Error("Firebase is not configured.");

  const payload = {
    candidateId: input.candidateId,
    positionId: input.positionId,
    interviewerId: input.interviewerId,
    interviewerName: input.interviewerName,
    phase: input.phase,
    questionScores: {},
    aggregateScore: 0,
    isComplete: false,
    lastQuestionIndex: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return mapEvaluation(ref.id, { ...payload, createdAt: new Date(), updatedAt: new Date() });
}

export async function saveQuestionEvaluation(
  evaluationId: string,
  questionId: string,
  questionScore: QuestionScore,
  questionIndex: number,
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  
  const evaluation = await getEvaluation(evaluationId);
  if (!evaluation) throw new Error("Evaluation not found");
  
  const questionScores = evaluation.questionScores || {};
  questionScores[questionId] = questionScore;
  
  // Calculate aggregate score from all completed questions
  const allScores = Object.values(questionScores);
  let aggregateScore = 0;
  
  if (allScores.length > 0) {
    const totalCriteria = allScores.reduce((sum: number, qs: QuestionScore) => {
      const criteriaValues = Object.values(qs.criteria.criteria || {});
      return sum + criteriaValues.reduce((a: number, b: number) => a + b, 0);
    }, 0);
    const totalMax = allScores.reduce((sum: number, qs: QuestionScore) => {
      const criteriaCount = Object.keys(qs.criteria.criteria || {}).length;
      return sum + (criteriaCount * 5); // Assuming max scale of 5
    }, 0);
    aggregateScore = totalMax > 0 ? Math.round((totalCriteria / totalMax) * 100) : 0;
  }
  
  await updateDoc(doc(db, COLLECTION, evaluationId), {
    questionScores,
    lastQuestionIndex: questionIndex,
    aggregateScore,
    updatedAt: serverTimestamp(),
  });
}

export async function completeEvaluation(
  evaluationId: string,
  notes?: string,
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  
  await updateDoc(doc(db, COLLECTION, evaluationId), {
    isComplete: true,
    notes,
    updatedAt: serverTimestamp(),
  });
}

export async function updateEvaluation(id: string, input: Partial<Evaluation>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.questionScores !== undefined) payload.questionScores = input.questionScores;
  if (input.aggregateScore !== undefined) payload.aggregateScore = input.aggregateScore;
  
  await updateDoc(doc(db, COLLECTION, id), payload);
}

export async function deleteEvaluation(id: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function aggregateCandidateScores(candidateId: string, phase: "phase1" | "phase2"): Promise<{
  averageScore: number;
  evaluationCount: number;
  criteriaBreakdown: { [criterionId: string]: { average: number; count: number } };
}> {
  const evaluations = await listEvaluations(candidateId, phase);
  const completedEvaluations = evaluations.filter(e => e.isComplete);
  
  if (completedEvaluations.length === 0) {
    return {
      averageScore: 0,
      evaluationCount: 0,
      criteriaBreakdown: {},
    };
  }
  
  // Calculate average aggregate score
  const totalScore = completedEvaluations.reduce((sum, e) => sum + e.aggregateScore, 0);
  const averageScore = Math.round(totalScore / completedEvaluations.length);
  
  // Calculate average for each criterion
  const criteriaBreakdown: { [criterionId: string]: { average: number; count: number } } = {};
  const criterionScores: { [criterionId: string]: number[] } = {};
  
  completedEvaluations.forEach(evaluation => {
    Object.values(evaluation.questionScores).forEach(questionScore => {
      Object.entries(questionScore.criteria.criteria || {}).forEach(([criterionId, score]) => {
        if (!criterionScores[criterionId]) {
          criterionScores[criterionId] = [];
        }
        criterionScores[criterionId].push(score as number);
      });
    });
  });
  
  Object.entries(criterionScores).forEach(([criterionId, scores]) => {
    criteriaBreakdown[criterionId] = {
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    };
  });
  
  return {
    averageScore,
    evaluationCount: completedEvaluations.length,
    criteriaBreakdown,
  };
}
