import { sendJSON } from "../lib/http.js";

export function handle(req, res, path) {
  if (req.method === "GET" && (path === "/health" || path === "/healthz")) {
    sendJSON(res, 200, { status: "ok" });
    return true;
  }
  return false;
}
