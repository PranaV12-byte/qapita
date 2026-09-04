"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthenticationProvider } from "@/lib/auth-provider";

export type AuthUser = {
  name?: string;
  email?: string;
  picture?: string;
  provider?: AuthenticationProvider;
};

type AuthState = {
  configured: boolean;
  loading: boolean;
  user: AuthUser | null;
  emailMode: "test" | "production";
  emailConfigured: boolean;
  testRecipientMasked?: string;
};

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: true,
  user: null,
  emailMode: "test",
  emailConfigured: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    configured: false,
    loading: true,
    user: null,
    emailMode: "test",
    emailConfigured: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session check failed");
        return response.json() as Promise<Omit<AuthState, "loading">>;
      })
      .then((nextState) => {
        if (!cancelled) setState({ ...nextState, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
