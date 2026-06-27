import { redirect } from "@tanstack/react-router";
import { waitForAuthInit } from "./auth-store";
import { getCandidate } from "./firebase/candidates";
import type { UserProfile } from "./firebase/types";

export async function requireAuth(): Promise<UserProfile> {
  const { profile } = await waitForAuthInit();
  if (!profile) {
    throw redirect({ to: "/login" });
  }
  return profile;
}

export async function requireGuest(): Promise<void> {
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
  const candidate = await getCandidate(candidateId);
  if (!candidate) {
    throw redirect({ to: "/candidate" });
  }
  if (!candidate.promotedToPhase2) {
    throw redirect({ to: "/candidate" });
  }
}
