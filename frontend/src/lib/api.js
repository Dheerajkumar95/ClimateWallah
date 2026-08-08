import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

export function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Admin API (auth + CSRF + cookies)
export const api = axios.create({ baseURL: API, withCredentials: true });
api.interceptors.request.use((cfg) => {
  const method = (cfg.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const token = getCookie("csrf_token");
    if (token) cfg.headers["X-CSRF-Token"] = token;
  }
  return cfg;
});

// Public API
export const publicApi = axios.create({ baseURL: `${API}/public` });

export function apiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && e.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
}
