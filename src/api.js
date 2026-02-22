// src/api.js
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token) {
  localStorage.setItem("token", token);
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("isLoggedIn");
}

export function logout() {
  clearAuth();
}

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * apiFetch
 * - Adds Authorization Bearer token automatically
 * - 401:
 *    - For /api/admin: DO NOT clear token (avoid "auto logout"), just throw error
 *    - For other endpoints: clear token and redirect to /login
 * - 403: throw Forbidden (do not clear token)
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Handle forbidden (authenticated but not allowed)
  if (res.status === 403) {
    const text = await res.text();
    const data = safeJsonParse(text);
    const msg = data?.message || data?.error || "Forbidden: Admin permission required";
    throw new Error(msg);
  }

  //  Handle unauthorized
  if (res.status === 401) {
    // If admin endpoint gives 401, DO NOT clear auth automatically
    // (prevents the "click admin -> logged out" behavior)
    if (String(path).startsWith("/api/admin")) {
      const text = await res.text();
      const data = safeJsonParse(text);
      const msg =
        data?.message ||
        data?.error ||
        "Unauthorized: token not accepted for admin endpoint (check backend JWT/roles)";
      throw new Error(msg);
    }

    // Other endpoints: treat as true logout/expired token
    clearAuth();
    if (window.location.pathname !== "/login") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return null;

  const text = await res.text();
  const data = safeJsonParse(text);

  if (!res.ok) {
    const msg = data?.message || data?.error || "Request failed";
    throw new Error(msg);
  }

  return data;
}

// ---- Optional: JWT role helper (no backend call) ----
export function getJwtPayload() {
  const token = getToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getMyRole() {
  const p = getJwtPayload();
  // your JwtService sets claim "role"
  return (p?.role || "USER").toUpperCase();
}

export function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s === "") return;
    usp.set(k, s);
  });
  const q = usp.toString();
  return q ? `?${q}` : "";
}
