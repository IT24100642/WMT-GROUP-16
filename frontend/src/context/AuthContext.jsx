import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, parseJson } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token"));

  const login = useCallback(async (username, password) => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("admin_token", data.token);
    setToken(data.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    setToken(null);
  }, []);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const res = await api(
        "/api/auth/change-password",
        { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
        token
      );
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error || "Could not update password");
    },
    [token]
  );

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
      changePassword,
    }),
    [token, login, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
