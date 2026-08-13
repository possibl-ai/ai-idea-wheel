import { createServer } from "http";
import { createClient, staticToken } from "@rcrt/sdk";

const PORT = process.env.PORT || "8080";
const RCRT_BASE_URL = process.env.RCRT_API_URL || "http://api-gateway.rcrt-platform.svc.cluster.local:8080";
const RCRT_SERVICE_KEY = process.env.RCRT_SERVICE_KEY || "";
const RCRT_TENANT_ID = process.env.RCRT_TENANT_ID || "";
const RCRT_USER_ID = process.env.RCRT_USER_ID || "";

const IDEA_TAG = "ai-idea-wheel:idea";

const client = createClient({
  baseURL: RCRT_BASE_URL,
  tokenProvider: staticToken(RCRT_SERVICE_KEY),
  tenantId: RCRT_TENANT_ID,
});

// ── HTML ───────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Idea Wheel</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f0f1e; color: #e0e0e0;
    display: flex; flex-direction: column; align-items: center;
    min-height: 100vh; padding: 20px;
  }
  h1 { color: #8b9dc3; font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #5a6a8a; font-size: 13px; margin-bottom: 24px; }

  /* ── chat ── */
  .chat-area {
    width: 90%; max-width: 500px; margin-bottom: 24px;
    background: #1a1a2e; border-radius: 16px; overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid #2a2a4a;
  }
  .chat-header { padding: 14px 20px; background: #16213e; border-bottom: 1px solid #2a2a4a; }
  .chat-header h2 { font-size: 14px; font-weight: 600; color: #8b9dc3; }
  .chat-header span { font-size: 11px; color: #5a6a8a; }
  .messages {
    max-height: 200px; overflow-y: auto; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .messages::-webkit-scrollbar { width: 5px; }
  .messages::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
  .msg { max-width: 85%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.45; word-wrap: break-word; }
  .msg.user { align-self: flex-end; background: #4a6fa5; color: #fff; }
  .msg.assistant { align-self: flex-start; background: #2a2a4a; color: #c0c0d0; }
  .msg.system { align-self: center; background: transparent; color: #6a7a9a; font-size: 12px; font-style: italic; }
  .msg.error { align-self: center; background: #4a2a2a; color: #ff8888; font-size: 12px; }
  .input-area { padding: 14px 20px; background: #16213e; border-top: 1px solid #2a2a4a; display: flex; gap: 10px; }
  .input-area input {
    flex: 1; padding: 10px 14px; background: #1a1a2e;
    border: 1px solid #2a2a4a; border-radius: 8px; color: #e0e0e0; font-size: 14px; outline: none;
  }
  .input-area input:focus { border-color: #4a6fa5; }
  .input-area button {
    padding: 10px 18px; background: #4a6fa5; color: #fff; border: none;
    border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s;
  }
  .input-area button:hover { background: #5a7fb5; }
  .input-area button:disabled { background: #3a3a5a; cursor: not-allowed; }

  /* ── wheel ── */
  .wheel-area {
    width: 90%; max-width: 420px;
    display: flex; flex-direction: column; align-items: center;
  }
  .wheel-header { margin-bottom: 16px; text-align: center; }
  .wheel-header h2 { font-size: 16px; color: #8b9dc3; margin-bottom: 2px; }
  .wheel-header span { font-size: 12px; color: #5a6a8a; }
  .wheel-wrap { position: relative; width: 360px; height: 360px; }
  canvas#wheel { width: 360px; height: 360px; cursor: pointer; }
  .pointer {
    position: absolute; top: -2px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 12px solid transparent; border-right: 12px solid transparent;
    border-top: 22px solid #ff6b6b; z-index: 2;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }
  .spin-btn {
    margin-top: 20px; padding: 14px 36px; background: #ff6b6b; color: #fff;
    border: none; border-radius: 12px; cursor: pointer;
    font-size: 16px; font-weight: 700; transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(255,107,107,0.3);
  }
  .spin-btn:hover:not(:disabled) { background: #ff8585; transform: translateY(-1px); }
  .spin-btn:disabled { background: #3a3a5a; cursor: not-allowed; box-shadow: none; }
  .result {
    margin-top: 16px; padding: 16px 24px; background: #1a1a2e;
    border: 1px solid #4a6fa5; border-radius: 12px; text-align: center;
    min-width: 280px; display: none;
  }
  .result.show { display: block; }
  .result-label { font-size: 12px; color: #5a6a8a; margin-bottom: 6px; }
  .result-idea { font-size: 18px; font-weight: 600; color: #8b9dc3; }
  .empty-hint { margin-top: 16px; color: #5a6a8a; font-size: 13px; font-style: italic; }
</style>
</head>
<body>
  <h1>AI Idea Wheel</h1>
  <div class="subtitle">Submit AI ideas in the chat — then spin the wheel to pick one!</div>

  <div class="chat-area">
    <div class="chat-header">
      <h2>Submit an AI Idea</h2>
      <span>Type your idea below and hit Send to add it to the wheel</span>
    </div>
    <div class="messages" id="messages">
      <div class="msg system">Submit your AI ideas below. Each one becomes a breadcrumb and appears on the wheel.</div>
    </div>
    <div class="input-area">
      <input type="text" id="input" placeholder="e.g. An AI that summarizes legal contracts..." autofocus />
      <button id="send" onclick="submitIdea()">Send</button>
    </div>
  </div>

  <div class="wheel-area">
    <div class="wheel-header">
      <h2>Idea Wheel</h2>
      <span>Click the wheel or the button to spin and pick a random idea</span>
    </div>
    <div class="wheel-wrap">
      <div class="pointer"></div>
      <canvas id="wheel" width="360" height="360" onclick="spin()"></canvas>
    </div>
    <button class="spin-btn" id="spinBtn" onclick="spin()">Spin the Wheel</button>
    <div class="result" id="result">
      <div class="result-label">Selected Idea</div>
      <div class="result-idea" id="resultIdea"></div>
    </div>
    <div class="empty-hint" id="emptyHint">Submit some ideas first to fill the wheel!</div>
  </div>

<script>
let ideas = [];
let currentAngle = 0;
let spinning = false;
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const spinBtn = document.getElementById("spinBtn");
const resultEl = document.getElementById("result");
const resultIdeaEl = document.getElementById("resultIdea");
const emptyHint = document.getElementById("emptyHint");

const COLORS = [
  "#4a6fa5", "#5a8fa5", "#6a5fa5", "#5aa57a",
  "#a55a7a", "#a57a5a", "#7a5aa5", "#5aa5a5",
  "#a5a55a", "#5a5aa5", "#a55a5a", "#5aa57a",
];

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !sendBtn.disabled) submitIdea();
});

function addMsg(text, cls) {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── wheel drawing ──
function drawWheel() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = canvas.width / 2 - 4;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (ideas.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#5a6a8a";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No ideas yet", cx, cy);
    return;
  }

  const slice = (Math.PI * 2) / ideas.length;

  for (let i = 0; i < ideas.length; i++) {
    const start = currentAngle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#0f0f1e";
    ctx.lineWidth = 2;
    ctx.stroke();

    // draw text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    const text = ideas[i].text.length > 28 ? ideas[i].text.substring(0, 25) + "..." : ideas[i].text;
    ctx.fillText(text, radius - 12, 4);
    ctx.restore();
  }

  // center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#16213e";
  ctx.fill();
  ctx.strokeStyle = "#4a6fa5";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function updateUI() {
  drawWheel();
  if (ideas.length === 0) {
    spinBtn.disabled = true;
    emptyHint.style.display = "block";
  } else {
    spinBtn.disabled = false;
    emptyHint.style.display = "none";
  }
}

// ── spin ──
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function spin() {
  if (spinning || ideas.length === 0) return;
  spinning = true;
  spinBtn.disabled = true;
  resultEl.classList.remove("show");

  const spins = 5 + Math.floor(Math.random() * 3);
  const targetIndex = Math.floor(Math.random() * ideas.length);
  const slice = (Math.PI * 2) / ideas.length;
  // pointer is at top (angle = -PI/2 in standard, but our 0 is at 3 o'clock going clockwise)
  // we want the target slice center to land at the top (-PI/2)
  const targetCenterAngle = targetIndex * slice + slice / 2;
  const finalAngle = -Math.PI / 2 - targetCenterAngle + spins * Math.PI * 2;
  const startAngle = currentAngle;
  const duration = 4000;
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    currentAngle = startAngle + (finalAngle - startAngle) * easeOut(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // normalize angle
      currentAngle = currentAngle % (Math.PI * 2);
      spinning = false;
      finishSpin(targetIndex);
    }
  }
  requestAnimationFrame(animate);
}

async function finishSpin(idx) {
  const selected = ideas[idx];
  resultIdeaEl.textContent = selected.text;
  resultEl.classList.add("show");

  // call the server to delete the breadcrumb
  try {
    const resp = await fetch("api/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id }),
    });
    const data = await resp.json();
    if (data.ok) {
      ideas.splice(idx, 1);
      updateUI();
    } else {
      addMsg("Failed to remove selected idea from the pool: " + (data.error || "unknown"), "error");
      spinBtn.disabled = false;
    }
  } catch (err) {
    addMsg("Network error removing idea: " + err.message, "error");
    spinBtn.disabled = false;
  }
}

// ── submit idea ──
async function submitIdea() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  sendBtn.disabled = true;
  addMsg(text, "user");

  try {
    const resp = await fetch("api/idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) {
      addMsg("Error: " + (data.error || "failed to save idea"), "error");
    } else {
      ideas.push({ id: data.id, text: data.text });
      updateUI();
      addMsg("Idea saved to the wheel! (" + ideas.length + " total)", "assistant");
    }
  } catch (err) {
    addMsg("Network error: " + err.message, "error");
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── initial load ──
async function loadIdeas() {
  try {
    const resp = await fetch("api/ideas");
    const data = await resp.json();
    if (data.ideas) {
      ideas = data.ideas.map((i) => ({ id: i.id, text: i.text }));
      updateUI();
    }
  } catch (err) {
    console.error("Failed to load ideas:", err);
  }
}

loadIdeas();
updateUI();
</script>
</body>
</html>`;

// ── Server ─────────────────────────────────────────────────────────────────

function sendJSON(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  // ── health ──
  if (req.method === "GET" && (req.url === "/health" || req.url === "/healthz")) {
    return sendJSON(res, 200, { status: "ok" });
  }

  // ── HTML page ──
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }

  // ── GET /api/ideas — list all active idea breadcrumbs ──
  if (req.method === "GET" && req.url === "/api/ideas") {
    try {
      const crumbs = await client.breadcrumbs.query({ tags: IDEA_TAG, limit: 1000 });
      const ideas = crumbs
        .filter((c) => !c.deleted_at)
        .map((c) => ({ id: c.id, text: c.title || c.name }));
      return sendJSON(res, 200, { ideas });
    } catch (err) {
      console.error("GET /api/ideas error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to list ideas" });
    }
  }

  // ── POST /api/idea — create a new idea breadcrumb ──
  if (req.method === "POST" && req.url === "/api/idea") {
    try {
      const body = JSON.parse(await readBody(req));
      const text = (body.text || "").trim();
      if (!text) return sendJSON(res, 400, { error: "text is required" });
      if (text.length > 500) return sendJSON(res, 400, { error: "idea too long (max 500 chars)" });

      const crumb = await client.breadcrumbs.create({
        name: `ai-idea-${Date.now()}`,
        title: text,
        content: { text, source: "ai-idea-wheel", created_by_user: RCRT_USER_ID || null },
        tags: [IDEA_TAG],
        upsert: false,
      });

      return sendJSON(res, 201, { id: crumb.id, text });
    } catch (err) {
      console.error("POST /api/idea error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to save idea" });
    }
  }

  // ── POST /api/select — soft-delete the selected idea breadcrumb ──
  if (req.method === "POST" && req.url === "/api/select") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = body.id;
      if (!id) return sendJSON(res, 400, { error: "id is required" });

      await client.breadcrumbs.delete(id);
      return sendJSON(res, 200, { ok: true, id });
    } catch (err) {
      console.error("POST /api/select error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to delete idea" });
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`ai-idea-wheel listening on :${PORT}`);
  console.log(`RCRT API: ${RCRT_BASE_URL}`);
  console.log(`Tenant:  ${RCRT_TENANT_ID || "(not set)"}`);
  console.log(`Key:     ${RCRT_SERVICE_KEY ? "set" : "(not set)"}`);
});