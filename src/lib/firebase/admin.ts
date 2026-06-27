import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./config";
import { listCandidates } from "./candidates";
import { listEvaluations } from "./evaluations";
import { listUsers } from "./users";

async function deleteDocsInBatches(docs: QueryDocumentSnapshot<DocumentData>[]): Promise<void> {
  if (!db || docs.length === 0) return;

  for (let index = 0; index < docs.length; index += 500) {
    const batch = writeBatch(db);
    const chunk = docs.slice(index, index + 500);

    chunk.forEach((snapshot) => {
      batch.delete(snapshot.ref);
    });

    await batch.commit();
  }
}

export async function deleteAllEvaluations(): Promise<number> {
  if (!db) return 0;

  const snapshots = await getDocs(collection(db, "evaluations"));
  if (snapshots.empty) return 0;

  await deleteDocsInBatches(snapshots.docs);
  return snapshots.size;
}

export async function resetAppDataExceptUsers(): Promise<{ deletedPositions: number; deletedCandidates: number; deletedEvaluations: number; preservedUsers: number }> {
  if (!db) {
    return { deletedPositions: 0, deletedCandidates: 0, deletedEvaluations: 0, preservedUsers: 0 };
  }

  const [positionsSnap, candidatesSnap, evaluationsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "positions")),
    getDocs(collection(db, "candidates")),
    getDocs(collection(db, "evaluations")),
    getDocs(collection(db, "users")),
  ]);

  const docsToDelete = [
    ...positionsSnap.docs,
    ...candidatesSnap.docs,
    ...evaluationsSnap.docs,
  ];

  if (docsToDelete.length > 0) {
    await deleteDocsInBatches(docsToDelete);
  }

  return {
    deletedPositions: positionsSnap.size,
    deletedCandidates: candidatesSnap.size,
    deletedEvaluations: evaluationsSnap.size,
    preservedUsers: usersSnap.size,
  };
}

export async function clearAllPositionScenariosAndQuestions(): Promise<number> {
  if (!db) return 0;

  const snapshots = await getDocs(collection(db, "positions"));
  if (snapshots.empty) return 0;

  for (const snapshot of snapshots.docs) {
    await updateDoc(doc(db, "positions", snapshot.id), {
      scenarios: [],
      questions: [],
      phase1Questions: [],
      phase2Questions: [],
      updatedAt: serverTimestamp(),
    });
  }

  return snapshots.size;
}

export async function getPhaseReleaseReadiness(positionId: string, field: "phase1ConsentReleased" | "phase2ConsentReleased") {
  const phase = field === "phase1ConsentReleased" ? "phase1" : "phase2";
  const [users, candidates] = await Promise.all([listUsers(), listCandidates(positionId)]);
  const interviewers = users.filter((user) => user.role === "interviewer");

  if (interviewers.length === 0) {
    return {
      canRelease: true,
      requiredInterviewerCount: 0,
      completedInterviewerCount: 0,
      pendingInterviewerCount: 0,
      reason: "No interviewers are configured yet.",
    };
  }

  const completedEvaluations = (await Promise.all(candidates.map((candidate) => listEvaluations(candidate.id, phase)))).flat();
  const completedInterviewerIds = new Set(
    completedEvaluations.filter((evaluation) => evaluation.isComplete).map((evaluation) => evaluation.interviewerId),
  );

  const completedInterviewerCount = interviewers.filter((interviewer) => completedInterviewerIds.has(interviewer.uid)).length;
  const pendingInterviewerCount = interviewers.length - completedInterviewerCount;

  return {
    canRelease: pendingInterviewerCount === 0,
    requiredInterviewerCount: interviewers.length,
    completedInterviewerCount,
    pendingInterviewerCount,
    reason: pendingInterviewerCount === 0
      ? "All configured interviewers have completed this phase."
      : `${pendingInterviewerCount} interviewer${pendingInterviewerCount === 1 ? "" : "s"} still need${pendingInterviewerCount === 1 ? "s" : ""} to complete ${phase === "phase1" ? "Phase 1" : "Phase 2"}.`,
  };
}

export async function getInterviewerProgress(positionId?: string) {
  const [users, candidates] = await Promise.all([listUsers(), listCandidates(positionId)]);

  if (users.length === 0) {
    return [];
  }

  const evaluationsByPhase = await Promise.all([
    Promise.all(candidates.map((candidate) => listEvaluations(candidate.id, "phase1"))),
    Promise.all(candidates.map((candidate) => listEvaluations(candidate.id, "phase2"))),
  ]);

  const phase1Evaluations = evaluationsByPhase[0].flat();
  const phase2Evaluations = evaluationsByPhase[1].flat();

  return users.map((user) => {
    const phase1Completed = phase1Evaluations.filter(
      (evaluation) => evaluation.interviewerId === user.uid && evaluation.isComplete,
    ).length;
    const phase2Completed = phase2Evaluations.filter(
      (evaluation) => evaluation.interviewerId === user.uid && evaluation.isComplete,
    ).length;

    return {
      ...user,
      phase1Completed,
      phase2Completed,
    };
  });
}
