import { create } from "zustand";

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  papel: string;
  tenantId: string;
  tenantNome: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem("token"),

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
