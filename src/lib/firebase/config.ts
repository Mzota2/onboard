import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { setAuthState } from "../auth-store";
import { getUserProfile } from "./users";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let authInitialized = false;
let authInitPromise: Promise<void> | null = null;

async function applyAuthUser(user: User | null): Promise<void> {
  if (!user) {
    setAuthState({
      firebaseUser: null,
      profile: null,
      loading: false,
      initialized: true,
    });
    return;
  }

  setAuthState({
    firebaseUser: user,
    profile: null,
    loading: true,
    initialized: false,
  });

  const profile = await getUserProfile(user.uid);
  setAuthState({
    firebaseUser: user,
    profile,
    loading: false,
    initialized: true,
  });
}

function bootstrapAuthListener(authInstance: Auth): Promise<void> {
  return new Promise((resolve) => {
    let bootstrapped = false;
    let pendingNullTimer: ReturnType<typeof setTimeout> | null = null;

    const finishBootstrap = () => {
      if (bootstrapped) return;
      bootstrapped = true;
      authInitialized = true;
      resolve();
    };

    onAuthStateChanged(authInstance, (user) => {
      const commit = (resolvedUser: User | null) => {
        void applyAuthUser(resolvedUser);
        finishBootstrap();
      };

      if (user) {
        if (pendingNullTimer) {
          clearTimeout(pendingNullTimer);
          pendingNullTimer = null;
        }
        commit(user);
        return;
      }

      if (bootstrapped) {
        commit(null);
        return;
      }

      if (pendingNullTimer) clearTimeout(pendingNullTimer);
      pendingNullTimer = setTimeout(() => commit(authInstance.currentUser), 600);
    });

    window.setTimeout(() => {
      if (!bootstrapped) {
        void applyAuthUser(authInstance.currentUser);
        finishBootstrap();
      }
    }, 2000);
  });
}

if (typeof window !== "undefined" && isFirebaseConfigured()) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  authInitPromise = setPersistence(auth, browserLocalPersistence)
    .then(async () => {
      if (!auth) {
        authInitialized = true;
        return;
      }
      await bootstrapAuthListener(auth);
    })
    .catch((error) => {
      console.error("Failed to set auth persistence:", error);
      authInitialized = true;
      setAuthState({
        firebaseUser: null,
        profile: null,
        loading: false,
        initialized: true,
      });
    });
} else if (typeof window !== "undefined") {
  setAuthState({
    firebaseUser: null,
    profile: null,
    loading: false,
    initialized: true,
  });
}

export function waitForFirebaseAuth(): Promise<void> {
  if (authInitialized) return Promise.resolve();
  if (authInitPromise) return authInitPromise;
  return Promise.resolve();
}

export { app, auth, db };
