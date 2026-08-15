import axios from "axios";

export const BACKEND = (
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export const API = `${BACKEND}/api`;

export function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));

  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Converts every upload URL to the configured backend URL.
 *
 * It also fixes old MongoDB records containing:
 * http://localhost:3000/api/uploads/...
 */
export function resolveUploadUrl(value = "") {
  if (!value) return "";

  try {
    const parsed = new URL(value, window.location.origin);

    if (parsed.pathname.startsWith("/api/uploads/")) {
      return `${BACKEND}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.href;
  } catch {
    if (value.startsWith("/api/uploads/")) {
      return `${BACKEND}${value}`;
    }

    if (value.startsWith("api/uploads/")) {
      return `${BACKEND}/${value}`;
    }

    return value;
  }
}

// Authenticated API
export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();

  if (["post", "put", "patch", "delete"].includes(method)) {
    const token = getCookie("csrf_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers["X-CSRF-Token"] = token;
    }
  }

  return config;
});

// Public API
export const publicApi = axios.create({
  baseURL: `${API}/public`,
});

export function apiError(detail) {
  if (detail == null) {
    return "Something went wrong. Please try again.";
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((error) => (error?.msg ? error.msg : JSON.stringify(error)))
      .join(" ");
  }

  if (detail?.msg) {
    return detail.msg;
  }

  return String(detail);
}
