import { createContext, useContext, useState, type ReactNode } from "react";
import type { AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  updateToken: (token: string) => void;
  logout: () => void;
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
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  function login(newToken: string, newUser: AuthUser) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function updateToken(newToken: string) {
    sessionStorage.setItem("token", newToken);
    setToken(newToken);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  function updateUser(newUser: AuthUser) {
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setUser(newUser);
  }

  return <AuthContext.Provider value={{ user, token, login, updateToken, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
