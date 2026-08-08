import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, apiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, object = authed, false = not authed

  const check = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/auth/me");
      setUser(data);
    } catch (e) {
      setUser(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = async (identifier, password) => {
    const { data } = await api.post("/admin/auth/login", { identifier, password });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/admin/auth/logout"); } catch (e) { /* noop */ }
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, check }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { apiError };
