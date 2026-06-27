import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./config";
import { createUserProfile } from "./users";
import type { CreateUserInput, UserProfile } from "./types";

function mapFirebaseError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Authentication failed. Please try again.";
  }
}

function ensureAuth() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Add your credentials to a .env file (see .env.example).",
    );
  }
  if (!auth) throw new Error("Firebase Auth is unavailable.");
  return auth;
}

export async function signUp(input: CreateUserInput): Promise<{ user: User; profile: UserProfile }> {
  const firebaseAuth = ensureAuth();
  const credential = await createUserWithEmailAndPassword(firebaseAuth, input.email, input.password);
  await updateProfile(credential.user, { displayName: input.displayName });
  const profile = await createUserProfile({
    uid: credential.user.uid,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
  });
  return { user: credential.user, profile };
}

export async function signIn(email: string, password: string): Promise<User> {
  const firebaseAuth = ensureAuth();
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return credential.user;
}

export async function signOut(): Promise<void> {
  const firebaseAuth = ensureAuth();
  await firebaseSignOut(firebaseAuth);
}

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return mapFirebaseError(error.code);
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
