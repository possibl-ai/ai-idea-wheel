import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { PORT, RCRT_BASE_URL, RCRT_TENANT_ID, RCRT_SERVICE_KEY } from "./config.js";
import { sendText, sendJSON } from "./lib/http.js";
import * as healthRoute from "./routes/health.js";
import * as ideasRoute from "./routes/ideas.js";
import * as spinRoute from "./routes/spin.js";
import * as completeRoute from "./routes/complete.js";
import * as brainstormRoute from "./routes/brainstorm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

const routeHandlers = [
  healthRoute,
  ideasRoute,
  spinRoute,
  completeRoute,
  brainstormRoute,
];

async function serveStatic(path) {
  let cleanPath = path === "/" ? "/index.html" : path;
  cleanPath = normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, cleanPath);

  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const data = await readFile(filePath);
    const ct = MIME[extname(filePath)] || "application/octet-stream";
    return { data, contentType: ct };
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  // API routes
  for (const mod of routeHandlers) {
    const handled = await mod.handle(req, res, path);
    if (handled) return;
  }

  // Static files
  if (req.method === "GET") {
    const file = await serveStatic(path);
    if (file) return sendText(res, 200, file.data, file.contentType);
  }

  sendJSON(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`ai-idea-wheel listening on :${PORT}`);
  console.log(`RCRT API: ${RCRT_BASE_URL}`);
  console.log(`Tenant:  ${RCRT_TENANT_ID || "(not set)"}`);
  console.log(`Key:     ${RCRT_SERVICE_KEY ? "set" : "(not set)"}`);
});
