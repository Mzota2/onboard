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
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";
import type { Candidate, CreateCandidateInput, SilhouetteKind, UpdateCandidateInput } from "./types";

const COLLECTION = "candidates";

function mapCandidate(id: string, data: DocumentData): Candidate {
  return {
    id,
    positionId: data.positionId ?? "",
    name: data.name ?? "",
    code: data.code ?? "",
    currentRole: data.currentRole ?? "",
    silhouette: (data.silhouette ?? "m1") as SilhouetteKind,
    status: data.status ?? "phase1",
    phase1Complete: data.phase1Complete ?? false,
    phase2Complete: data.phase2Complete ?? false,
    phase1Scores: data.phase1Scores ?? null,
    phase2Scores: data.phase2Scores ?? null,
    promoted: data.promoted ?? false,
    promotedToPhase2: data.promotedToPhase2 ?? false,
    promotionMethod: data.promotionMethod ?? null,
    rank: data.rank ?? 0,
    aggregateScore: data.aggregateScore ?? 0,
    disqualified: data.disqualified ?? false,
    disqualifiedAt: data.disqualifiedAt?.toDate?.()?.toISOString?.(),
    disqualifiedReason: data.disqualifiedReason,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function listCandidates(positionId?: string): Promise<Candidate[]> {
  if (!db) return [];

  const q = positionId
    ? query(collection(db, COLLECTION), where("positionId", "==", positionId))
    : query(collection(db, COLLECTION));

  const snap = await getDocs(q);
  const candidates = snap.docs.map((d) => mapCandidate(d.id, d.data()));
  return candidates.sort((a, b) => a.rank - b.rank || b.aggregateScore - a.aggregateScore);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return mapCandidate(snap.id, snap.data());
}

export async function createCandidate(input: CreateCandidateInput): Promise<Candidate> {
  if (!db) throw new Error("Firebase is not configured.");

  const existing = await listCandidates(input.positionId);
  const payload = {
    positionId: input.positionId,
    name: input.name,
    code: input.code,
    currentRole: input.currentRole,
    silhouette: input.silhouette ?? "m1",
    status: "phase1",
    phase1Complete: false,
    phase2Complete: false,
    promoted: false,
    rank: existing.length + 1,
    aggregateScore: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  return mapCandidate(ref.id, { ...payload, createdAt: new Date(), updatedAt: new Date() });
}

export async function updateCandidatePhase1Scores(
  id: string,
  data: { phase1Complete: boolean },
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateCandidatePhase2Scores(
  id: string,
  data: { phase2Complete: boolean },
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    status: "phase2",
    updatedAt: serverTimestamp(),
  });
}

export async function promoteCandidates(ids: string[]): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const firestore = db;
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(firestore, COLLECTION, id), {
        promoted: true,
        status: "phase2",
        updatedAt: serverTimestamp(),
      }),
    ),
  );
}

export async function autoPromoteTopCandidates(positionId: string, topN: number): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  
  const candidates = await listCandidates(positionId);
  const completedPhase1 = candidates.filter(c => c.phase1Complete && !c.promotedToPhase2);
  
  // Sort by aggregate score descending
  const sorted = completedPhase1.sort((a, b) => b.aggregateScore - a.aggregateScore);
  
  // Promote top N candidates
  const topCandidates = sorted.slice(0, topN);
  
  if (topCandidates.length > 0) {
    await Promise.all(
      topCandidates.map(c =>
        updateCandidate(c.id, {
          promotedToPhase2: true,
          promotionMethod: "automatic",
          status: "phase2",
        })
      )
    );
  }
}

export async function updateCandidate(id: string, input: UpdateCandidateInput): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, COLLECTION, id), { ...input, updatedAt: serverTimestamp() });
}

export async function deleteCandidate(id: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function deleteCandidatesByPosition(positionId: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const candidates = await listCandidates(positionId);
  await Promise.all(candidates.map((c) => deleteDoc(doc(db!, COLLECTION, c.id))));
}

export function computePipelineStats(candidates: Candidate[]) {
  // Exclude disqualified candidates from pipeline stats
  const activeCandidates = candidates.filter((c) => !c.disqualified);
  const phase1 = activeCandidates.filter((c) => c.status === "phase1");
  const phase2 = activeCandidates.filter((c) => c.status === "phase2" || c.promoted);
  const phase1Pending = phase1.filter((c) => !c.phase1Complete).length;
  const phase2Pending = phase2.filter((c) => !c.phase2Complete).length;

  const phase1Scores = phase1.filter((c) => c.aggregateScore > 0).map((c) => c.aggregateScore);
  const phase2Scores = phase2.filter((c) => c.aggregateScore > 0).map((c) => c.aggregateScore);

  const avg = (nums: number[]) =>
    nums.length ? Math.min(5, Math.max(1, Math.round(nums.reduce((a, b) => a + b, 0) / nums.length / 20))) : 0;

  return {
    phase1Count: phase1.length,
    phase2Count: phase2.length,
    phase1Pending,
    phase2Pending,
    phase1AvgScore: avg(phase1Scores),
    phase2AvgScore: avg(phase2Scores),
  };
}
