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
