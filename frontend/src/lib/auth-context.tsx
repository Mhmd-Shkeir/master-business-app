import { createContext, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "./types";
import { api } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  updateToken: (token: string) => void;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Clear persistent legacy credentials; new access tokens live only for this tab session.
try {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
} catch { /* Local storage may be disabled. */ }

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  function login(newToken: string, newUser: AuthUser) {
    queryClient.clear(); // Drop all previous account query AND mutation results.
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function updateToken(newToken: string) {
    queryClient.clear();
    sessionStorage.setItem("token", newToken);
    setToken(newToken);
  }

  async function logout() {
    const currentToken = sessionStorage.getItem("token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    queryClient.clear(); // Clear private results immediately, before network latency.
    setToken(null);
    setUser(null);
    if (currentToken) {
      try {
        await api.post("/auth/logout", {}, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // Locally signed out even if server-side revocation is unavailable.
      }
    }
  }

  function updateUser(newUser: AuthUser) {
    queryClient.clear(); // Role and permission changes must invalidate cached data.
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setUser(newUser);
  }

  return <AuthContext.Provider value={{ user, token, login, updateToken, logout, updateUser }}>{children}</AuthContext.Provider>;
}

/** Scope all protected cached reads to account AND role. */
export function usePrivateQueryScope() {
  const { user } = useAuth();
  return [user?.id ?? "anonymous", user?.role ?? "none"] as const;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
