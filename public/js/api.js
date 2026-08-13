import { API } from "./config.js";

export async function api(method, path, body) {
  const opt = { method, headers: {} };
  if (body) {
    opt.headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opt);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "HTTP " + res.status);
  }
  return res.status === 204 ? null : res.json();
}
