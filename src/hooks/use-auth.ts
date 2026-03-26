"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          // Session expired or invalid — redirect to login
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          throw new Error("Not authenticated");
        }
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data: AuthUser) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const canEdit = user?.role === "admin" || user?.role === "user";

  return { user, isLoading, logout, canEdit };
}
