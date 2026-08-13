import { sendJSON, readJSON } from "../lib/http.js";
import { completeIdea, restoreIdea } from "../services/breadcrumbStore.js";

export async function handle(req, res, path) {
  if (req.method === "POST" && path === "/api/complete") {
    try {
      const { id } = await readJSON(req);
      if (!id) { sendJSON(res, 400, { error: "id is required" }); return true; }
      const idea = await completeIdea(id);
      sendJSON(res, 200, idea);
    } catch (err) {
      console.error("POST /api/complete error:", err);
      sendJSON(res, 500, { error: err.message || "failed to complete idea" });
    }
    return true;
  }

  if (req.method === "POST" && path === "/api/restore") {
    try {
      const { id } = await readJSON(req);
      if (!id) { sendJSON(res, 400, { error: "id is required" }); return true; }
      const idea = await restoreIdea(id);
      sendJSON(res, 200, idea);
    } catch (err) {
      console.error("POST /api/restore error:", err);
      sendJSON(res, 500, { error: err.message || "failed to restore" });
    }
    return true;
  }

  return false;
}
