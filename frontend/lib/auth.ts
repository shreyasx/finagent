const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "finagent_token";

export interface AuthUser {
  id: string;
  email: string;
  interaction_count: number;
  max_interactions: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<{ token: string; email: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(data.detail || "Login failed");
  }

  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function signup(email: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Signup failed" }));
    throw new Error(data.detail || "Signup failed");
  }

  return res.json();
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/verify?token=${encodeURIComponent(token)}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Verification failed" }));
    throw new Error(data.detail || "Verification failed");
  }

  return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
    }
    return null;
  }

  return res.json();
}
