import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, parseJson } from "../api/client.js";
import { checkCustomerLogoutBlockers } from "../lib/customerLogoutGuard.js";

const CustomerAuthContext = createContext(null);

function normalizeCustomer(data) {
  if (!data) return null;
  return {
    id: data._id,
    email: data.email,
    customerNumber: data.customerNumber,
    createdAt: data.createdAt,
  };
}

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("customer_token"));
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    if (token) {
      const gate = await checkCustomerLogoutBlockers(token);
      if (!gate.ok) {
        return { ok: false, reasons: gate.reasons };
      }
    }
    localStorage.removeItem("customer_token");
    setToken(null);
    setUser(null);
    return { ok: true };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }
      const res = await api("/api/customer-auth/me", {}, token);
      const data = await parseJson(res);
      if (cancelled) return;
      if (res.ok) {
        setUser(normalizeCustomer(data));
      } else {
        localStorage.removeItem("customer_token");
        setToken(null);
        setUser(null);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await api("/api/customer-auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("customer_token", data.token);
    setToken(data.token);
    setUser(normalizeCustomer(data.customer));
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const res = await api(
      "/api/customer-auth/change-password",
      { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
      token
    );
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error || "Could not update password");
  }, [token]);

  const register = useCallback(async (email, password, confirmPassword) => {
    const res = await api("/api/customer-auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim(),
        password,
        confirmPassword,
      }),
    });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error || "Registration failed");
    localStorage.setItem("customer_token", data.token);
    setToken(data.token);
    const customer = normalizeCustomer(data.customer);
    setUser(customer);
    return customer;
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      isAuthenticated: ready && Boolean(user),
      login,
      register,
      changePassword,
      logout,
    }),
    [token, user, ready, login, register, changePassword, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth requires CustomerAuthProvider");
  return ctx;
}
