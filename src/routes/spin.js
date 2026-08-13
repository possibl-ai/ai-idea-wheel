import { sendJSON, readJSON } from "../lib/http.js";
import { recordSpin } from "../services/breadcrumbStore.js";

export async function handle(req, res, path) {
  if (req.method === "POST" && path === "/api/spin") {
    try {
      const body = await readJSON(req);
      await recordSpin(body);
      sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error("POST /api/spin error:", err);
      sendJSON(res, 500, { error: err.message || "failed to record spin" });
    }
    return true;
  }
  return false;
}
