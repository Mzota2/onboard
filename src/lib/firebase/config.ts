import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

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

if (typeof window !== "undefined" && isFirebaseConfigured()) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Set auth persistence to LOCAL (uses secure browser storage)
  authInitPromise = setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // Wait for auth to initialize and restore session
      return new Promise<void>((resolve) => {
        if (!auth) {
          authInitialized = true;
          resolve();
          return;
        }
        const unsubscribe = onAuthStateChanged(auth, () => {
          authInitialized = true;
          unsubscribe();
          resolve();
        });
      });
    })
    .catch((error) => {
      console.error("Failed to set auth persistence:", error);
      authInitialized = true;
    });
}

export function waitForFirebaseAuth(): Promise<void> {
  if (authInitialized) return Promise.resolve();
  if (authInitPromise) return authInitPromise;
  return Promise.resolve();
}

export { app, auth, db };
