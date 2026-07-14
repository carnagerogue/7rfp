import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { flushSync } from "react-dom";
import { apiRequest, queryClient } from "./queryClient";

export type AuthAccount = {
  id: number;
  email: string;
  companyName: string;
  plan: string;
};

type AuthContextValue = {
  account: AuthAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/auth/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.account))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    flushSync(() => setAccount(data.account));
    queryClient.clear();
  }

  async function signup(email: string, password: string, companyName: string) {
    const res = await apiRequest("POST", "/api/auth/signup", { email, password, companyName });
    const data = await res.json();
    flushSync(() => setAccount(data.account));
    queryClient.clear();
  }

  async function logout() {
    await apiRequest("POST", "/api/auth/logout").catch(() => undefined);
    setAccount(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ account, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!loading && !account) setLocation("/login");
  }, [account, loading, setLocation]);
  if (loading || !account) return null;
  return <>{children}</>;
}
