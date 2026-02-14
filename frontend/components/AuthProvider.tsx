"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthUser, fetchCurrentUser, clearToken, getToken } from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const publicPaths = ["/login", "/signup", "/verify"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    const u = await fetchCurrentUser();
    setUser(u);
    return;
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        const u = await fetchCurrentUser();
        setUser(u);
        if (!u && !publicPaths.includes(pathname)) {
          router.replace("/login");
        }
      } else if (!publicPaths.includes(pathname)) {
        router.replace("/login");
      }
      setLoading(false);
    };
    init();
  }, [pathname, router]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.replace("/login");
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
