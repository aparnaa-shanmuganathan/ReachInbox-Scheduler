"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AuthUser } from "@/types";

const TOKEN_STORAGE_KEY = "reachinbox_token";

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Client-side JWT payload decode for display purposes only (name/email/avatar in the
// header). The token itself is opaque to the browser beyond this — every real
// authorization check happens server-side when the backend verifies the signature.
function decodeUser(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return { sub: json.sub, email: json.email, name: json.name, avatarUrl: json.avatarUrl };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) setTokenState(stored);
    setIsLoading(false);
  }, []);

  const setToken = useCallback((next: string) => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, next);
    setTokenState(next);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setTokenState(null);
  }, []);

  const user = token ? decodeUser(token) : null;

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
