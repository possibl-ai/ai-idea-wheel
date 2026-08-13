import { sendJSON, readJSON } from "../lib/http.js";
import { listIdeas, createIdea, deleteIdea, clearAllIdeas } from "../services/breadcrumbStore.js";

export async function handle(req, res, path) {
  if (req.method === "GET" && path === "/api/ideas") {
    try {
      const ideas = await listIdeas();
      sendJSON(res, 200, { ideas });
    } catch (err) {
      console.error("GET /api/ideas error:", err);
      sendJSON(res, 500, { error: err.message || "failed to list ideas" });
    }
    return true;
  }

  if (req.method === "POST" && path === "/api/idea") {
    try {
      const body = await readJSON(req);
      const idea = await createIdea(body);
      sendJSON(res, 201, idea);
    } catch (err) {
      console.error("POST /api/idea error:", err);
      sendJSON(res, 500, { error: err.message || "failed to save idea" });
    }
    return true;
  }

  if (req.method === "DELETE" && path.startsWith("/api/idea/")) {
    try {
      const id = path.replace("/api/idea/", "");
      if (!id) { sendJSON(res, 400, { error: "id is required" }); return true; }
      await deleteIdea(id);
      sendJSON(res, 204, null);
    } catch (err) {
      console.error("DELETE /api/idea error:", err);
      sendJSON(res, 500, { error: err.message || "failed to delete" });
    }
    return true;
  }

  if (req.method === "DELETE" && path === "/api/ideas") {
    try {
      await clearAllIdeas();
      sendJSON(res, 204, null);
    } catch (err) {
      sendJSON(res, 500, { error: err.message || "failed to clear" });
    }
    return true;
  }

  return false;
}
