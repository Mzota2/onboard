import type { User } from "firebase/auth";
import type { UserProfile } from "./firebase/types";

export interface AuthState {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}

type AuthListener = (state: AuthState) => void;

let state: AuthState = {
  firebaseUser: null,
  profile: null,
  loading: true,
  initialized: false,
};

const listeners = new Set<AuthListener>();

export function getAuthState(): AuthState {
  return state;
}

export function setAuthState(next: AuthState): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function waitForAuthInit(): Promise<AuthState> {
  if (state.initialized) return Promise.resolve(state);

  // Firebase auth only initializes in the browser (see firebase/config.ts).
  // Route beforeLoad guards run during SSR too — never block waiting for the client.
  if (typeof window === "undefined") {
    return Promise.resolve({
      firebaseUser: null,
      profile: null,
      loading: false,
      initialized: true,
    });
  }

  return new Promise((resolve) => {
    const unsub = subscribeAuth((current) => {
      if (current.initialized) {
        unsub();
        resolve(current);
      }
    });
  });
}
