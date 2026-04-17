import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, parseJson } from "../api/client.js";

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("staff_token"));
  const [profile, setProfile] = useState(null);

  const login = useCallback(async (username, password) => {
    const res = await api("/api/staff-portal/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("staff_token", data.token);
    setToken(data.token);
    setProfile({ name: data.name, username: data.username, roleName: data.roleName });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("staff_token");
    setToken(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      return;
    }
    const res = await api("/api/staff-portal/me", {}, token);
    const data = await parseJson(res);
    if (res.ok) {
      setProfile({
        name: data.name,
        username: data.username,
        roleName: data.role?.name || "",
      });
    } else {
      localStorage.removeItem("staff_token");
      setToken(null);
      setProfile(null);
    }
  }, [token]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const res = await api(
        "/api/staff-portal/change-password",
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
      profile,
      isAuthenticated: Boolean(token),
      login,
      logout,
      changePassword,
      refreshProfile,
    }),
    [token, profile, login, logout, changePassword, refreshProfile]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error("useStaffAuth requires StaffAuthProvider");
  return ctx;
}
