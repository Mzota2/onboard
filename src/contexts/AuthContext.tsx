import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { auth, isFirebaseConfigured } from "@/lib/firebase/config";
import { getUserProfile } from "@/lib/firebase/users";
import { getAuthState, setAuthState, subscribeAuth, type AuthState } from "@/lib/auth-store";

interface AuthContextValue extends AuthState {
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [localState, setLocalState] = useState<AuthState>(getAuthState());
  const authResolvedRef = useRef(false);

  useEffect(() => subscribeAuth(setLocalState), []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setAuthState({
        firebaseUser: null,
        profile: null,
        loading: false,
        initialized: true,
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        if (!authResolvedRef.current) {
          authResolvedRef.current = true;
        }
        setAuthState({
          firebaseUser: null,
          profile: null,
          loading: false,
          initialized: true,
        });
        return;
      }

      authResolvedRef.current = true;
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
    });

    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    const current = getAuthState();
    if (!current.firebaseUser) return;
    const profile = await getUserProfile(current.firebaseUser.uid);
    setAuthState({ ...current, profile });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...localState,
      isAdmin: localState.profile?.role === "admin",
      refreshProfile,
    }),
    [localState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
