import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./config";
import type { UserProfile, UserRole, UserSettings } from "./types";

const COLLECTION = "users";

function toInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function mapUser(id: string, data: DocumentData): UserProfile {
  return {
    uid: id,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    role: data.role ?? "interviewer",
    initials: data.initials ?? "??",
    settings: {
      vettingAlerts: data.settings?.vettingAlerts ?? true,
      autoLock: data.settings?.autoLock ?? false,
    },
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? "",
  };
}

export async function createUserProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
}): Promise<UserProfile> {
  if (!db) throw new Error("Firebase is not configured.");

  const settings: UserSettings = { vettingAlerts: true, autoLock: false };
  const profile = {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    initials: toInitials(input.displayName),
    settings,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTION, input.uid), profile);
  return mapUser(input.uid, { ...profile, createdAt: new Date(), updatedAt: new Date() });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

export async function updateUserSettings(uid: string, settings: Partial<UserSettings>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const current = await getUserProfile(uid);
  await updateDoc(doc(db, COLLECTION, uid), {
    settings: { ...current?.settings, vettingAlerts: true, autoLock: false, ...settings },
    updatedAt: serverTimestamp(),
  });
}
