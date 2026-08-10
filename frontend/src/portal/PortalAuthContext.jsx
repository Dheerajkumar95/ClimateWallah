import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, apiError } from "@/lib/api";

const PortalAuthContext = createContext(null);

const PORTAL_PATHS = ["/portal", "/reviewer"];

export function PortalAuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, object = authed, false = not authed

  const check = useCallback(async () => {
    const p = window.location.pathname;
    if (!PORTAL_PATHS.some((base) => p.startsWith(base))) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      setUser(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    setUser(data);
    return data;
  };

  const verifyOtp = async (email, otp) => {
    const { data } = await api.post("/auth/client/verify-otp", { email, otp });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* noop */ }
    setUser(false);
  };

  return (
    <PortalAuthContext.Provider value={{ user, setUser, login, verifyOtp, logout, check }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

export { apiError };
