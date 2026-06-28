import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getUserProfile } from "@/lib/firebase/users";
import { getAuthState, setAuthState, subscribeAuth, type AuthState } from "@/lib/auth-store";

interface AuthContextValue extends AuthState {
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [localState, setLocalState] = useState<AuthState>(getAuthState());

  useEffect(() => subscribeAuth(setLocalState), []);

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
