import { redirect } from "@tanstack/react-router";
import { waitForAuthInit } from "./auth-store";
import { waitForFirebaseAuth } from "./firebase/config";
import { getCandidate } from "./firebase/candidates";
import { getPosition } from "./firebase/positions";
import type { UserProfile } from "./firebase/types";
import { canStartPhase2Review } from "./phase2-access";

export async function requireAuth(): Promise<UserProfile> {
  // Auth state is unavailable during SSR — defer the check to the client.
  if (typeof window === "undefined") {
    return null as unknown as UserProfile;
  }

  await waitForFirebaseAuth();

  const { profile } = await waitForAuthInit();
  if (!profile) {
    throw redirect({ to: "/login" });
  }
  return profile;
}

export async function requireGuest(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  await waitForFirebaseAuth();

  const { profile } = await waitForAuthInit();
  if (profile) {
    throw redirect({ to: "/" });
  }
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireAuth();
  if (profile.role !== "admin") {
    throw redirect({ to: "/" });
  }
  return profile;
}

export async function requirePhase2Access(candidateId: string): Promise<void> {
  const profile = await requireAuth();
  const candidate = await getCandidate(candidateId);
  if (!candidate) {
    throw redirect({ to: "/candidate" });
  }

  const position = candidate.positionId ? await getPosition(candidate.positionId) : null;
  if (!canStartPhase2Review({ promotedToPhase2: candidate.promotedToPhase2, phase1ConsentReleased: position?.phase1ConsentReleased })) {
    throw redirect({ to: "/candidate" });
  }
}
