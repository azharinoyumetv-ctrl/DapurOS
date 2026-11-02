import { sessionToken } from "@/auth/session";
import axios from "axios";

const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (typeof window !== "undefined" && window.location.origin.includes("dagangos.com")) {
    return window.location.origin;
  }
  if (typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return envUrl && envUrl !== "undefined" && envUrl !== "" ? envUrl : "http://localhost:8000";
  }
  if (envUrl && envUrl !== "undefined" && envUrl !== "" && !envUrl.includes("localhost")) {
    return envUrl;
  }
  return "https://dagangos.com";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE = `${BACKEND_URL.replace(/\/$/, "")}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const t = sessionToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  cfg.headers["X-DagangOS-Module"] = "dapuros";

  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Akun belum punya toko untuk modul ini -> arahkan ke halaman aktivasi modul.
    if (
      err?.response?.status === 409 &&
      err?.response?.data?.detail === "no_store_for_module" &&
      typeof window !== "undefined" &&
      !window.location.pathname.includes("/activate")
    ) {
      window.location.href = "/dapuros/activate";
    }
    return Promise.reject(err);
  }
);

export default api;

export function fmtIDR(n) {
  if (n === null || n === undefined || isNaN(n)) return "Rp 0";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPdf(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  downloadBlob(res.data, filename);
}

