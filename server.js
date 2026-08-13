import { createServer } from "http";
import { createClient, staticToken } from "@rcrt/sdk";

const PORT = process.env.PORT || "8080";
const RCRT_BASE_URL = process.env.RCRT_API_URL || "http://api-gateway.rcrt-platform.svc.cluster.local:8080";
const RCRT_SERVICE_KEY = process.env.RCRT_SERVICE_KEY || "";
const RCRT_TENANT_ID = process.env.RCRT_TENANT_ID || "";
const RCRT_USER_ID = process.env.RCRT_USER_ID || "";

const IDEA_TAG = "ai-idea-wheel:idea";
const SPIN_TAG = "ai-idea-wheel:spin";
const COMPLETION_TAG = "ai-idea-wheel:completion";

const client = createClient({
  baseURL: RCRT_BASE_URL,
  tokenProvider: staticToken(RCRT_SERVICE_KEY),
  tenantId: RCRT_TENANT_ID,
});

// ── Helpers ────────────────────────────────────────────────────────────────

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

// Map a breadcrumb row to the rich idea shape the UI expects.
function crumbToIdea(c) {
  const ct = c.content || {};
  return {
    id: c.id,
    title: c.title || ct.title || c.name,
    text: ct.text || c.title || c.name,
    description: ct.description || "",
    category: ct.category || "LLM & Agents",
    difficulty: ct.difficulty || "Beginner",
    estimatedHours: ct.estimatedHours ?? 0.75,
    tags: ct.tags || ["AILab"],
    objectives: ct.objectives || [],
    status: ct.status || "active",
    createdAt: ct.createdAt || c.created_at || new Date().toISOString(),
    completedAt: ct.completedAt || null,
    color: ct.color || CATEGORY_COLORS[ct.category] || "#A655F7",
  };
}

const CATEGORY_COLORS = {
  "LLM & Agents": "#6366f1",
  "Computer Vision": "#10b981",
  "Audio & Multimodal": "#ec4899",
  "Automation & RAG": "#f59e0b",
  "Creative AI & Gaming": "#8b5cf6",
  "Fun & Experimental": "#06b6d4",
};

// ── AI generation via RCRT chat agent ──────────────────────────────────────
// Instead of calling a Gemini API key directly, we route idea generation
// through the RCRT platform's agent pipeline via client.chat.send() +
// client.chat.stream(). The agent is instructed to return JSON; we parse it
// defensively and fall back to prose-splitting if the model doesn't comply.

const BRAINSTORM_PROMPT = (topic) =>
  `Brainstorm 3 creative, hands-on AI Lab session ideas for a weekly tech team meetup. ` +
  `Focus topic: "${topic || "General AI & fast prototyping"}". ` +
  `Each project MUST be buildable in UNDER 1 HOUR. ` +
  `Respond with ONLY a JSON array (no markdown, no prose). Each element: ` +
  `{ "title": string, "description": string, "category": one of ${JSON.stringify(Object.keys(CATEGORY_COLORS))}, ` +
  `"difficulty": "Beginner"|"Intermediate"|"Advanced"|"Expert", "estimatedHours": number 0.5–1.0, ` +
  `"tags": string[3], "objectives": string[3] }.`;

const ENHANCE_PROMPT = (title, description) =>
  `Enhance this AI lab session idea into a quick hands-on project buildable in under 1 hour. ` +
  `Title: "${title}". Description: "${description || "none"}". ` +
  `Respond with ONLY a JSON object (no markdown, no prose) with the same schema: ` +
  `{ "title", "description", "category", "difficulty", "estimatedHours", "tags": string[], "objectives": string[] }. ` +
  `Category must be one of ${JSON.stringify(Object.keys(CATEGORY_COLORS))}.`;

async function generateViaAgent(prompt) {
  const chatResp = await client.chat.send({
    message: prompt,
    user_id: RCRT_USER_ID || undefined,
  });

  console.log("[agent] chat.send OK, session:", chatResp.session_id);

  let reply = "";
  let eventCount = 0;
  let gotStreamComplete = false;
  let postCompleteDeadline = 0;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 60000);

  try {
    for await (const evt of client.chat.stream(chatResp.session_id, { signal: ac.signal })) {
      eventCount++;
      console.log(`[agent] evt#${eventCount} type=${evt.type} dataLen=${(evt.data||"").length}`);
      if (evt.type === "delta") {
        try {
          const payload = JSON.parse(evt.data);
          const chunk = payload.delta || payload.text || payload.content || "";
          if (chunk) { reply += chunk; console.log(`[agent]   delta chunk: ${chunk.slice(0,80)}`); }
        } catch {
          reply += evt.data || "";
        }
      } else if (evt.type === "message") {
        try {
          const payload = JSON.parse(evt.data);
          const sourceType = payload.content?.source_type;
          const finishReason = payload.content?.finish_reason;
          console.log(`[agent]   message source_type=${sourceType} finish=${finishReason} keys=${Object.keys(payload.content||{}).join(",")}`);

          // Tool-use messages (finish_reason=tool_use) are intermediate —
          // the agent is calling tools (memory-search, think). Don't break;
          // keep listening for the final response.
          if (sourceType && sourceType !== "user" && finishReason !== "tool_use") {
            let agentText = payload.content?.content || payload.content?.text || "";
            if (!agentText && payload.content?.tool_calls) {
              for (const tc of payload.content.tool_calls) {
                try {
                  const args = JSON.parse(tc.function?.arguments || "{}");
                  if (args.response) { agentText = args.response; break; }
                  if (args.message) { agentText = args.message; break; }
                  if (args.context) { agentText = args.context; break; }
                } catch {}
              }
            }
            if (agentText) {
              console.log(`[agent]   agent text: ${agentText.slice(0,200)}`);
              reply = agentText; break;
            }
          }
          // Tool execution messages (source_type undefined) carry the
          // agent's actual response in the "output" field.
          if (payload.content?.output) {
            const out = payload.content.output;
            if (typeof out === "string" && out.length > 10) {
              console.log(`[agent]   tool output: ${out.slice(0,200)}`);
              reply = out; break;
            }
            if (out && typeof out === "object" && out.text) {
              reply = out.text; break;
            }
          }
        } catch {}
      } else if (evt.type === "stream.complete") {
        console.log(`[agent]   stream.complete, reply so far: ${reply.length} chars`);
        if (reply) break;
        gotStreamComplete = true;
        postCompleteDeadline = Date.now() + 20000;
      } else if (evt.type === "heartbeat") {
        if (gotStreamComplete && Date.now() > postCompleteDeadline) {
          console.log("[agent]   heartbeat deadline exceeded");
          break;
        }
      }
    }
  } catch (e) {
    console.log("[agent] stream error:", e.message);
  }
  console.log(`[agent] done. events=${eventCount} reply=${reply.length} chars`);
  clearTimeout(timeout);

  // Fallback: fetch the agent's response breadcrumb directly.
  if (!reply && chatResp.id) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const crumbs = await client.breadcrumbs.query({
          tags: [`session:${chatResp.session_id}`],
          limit: 10,
        });
        for (const c of crumbs) {
          const content = c.content?.content || c.content?.text || "";
          const sourceType = c.content?.source_type;
          if (sourceType && sourceType !== "user" && content) {
            reply = content;
            break;
          }
        }
        if (reply) break;
      } catch {}
    }
  }

  return reply;
}

// Defensively extract a JSON array or object from the agent's reply.
function parseAgentJSON(reply) {
  if (!reply) return null;
  // Try direct parse first.
  try {
    const v = JSON.parse(reply);
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return v;
  } catch {}
  // Try fenced ```json ... ``` or ``` ... ``` blocks.
  const fenceMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }
  // Try to extract an embedded JSON array.
  const arrMatch = reply.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }
  // Try to extract an embedded JSON object.
  const objMatch = reply.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return null;
}

// Parse a markdown-formatted agent reply into idea stubs.
// Handles patterns like:
//   1. **Title:** Some title
//      **Description:** Some description
//      **Category:** LLM & Agents
//      **Difficulty:** Beginner
//   2. ...
function parseMarkdownIdeas(reply) {
  if (!reply) return [];
  const ideas = [];
  // Split on numbered items: "1. ", "2. ", etc.
  const blocks = reply.split(/\n(?=\d+\.\s)/);
  for (const block of blocks) {
    const titleM = block.match(/\*\*Title:?\*\*\s*(.+)/i);
    const descM = block.match(/\*\*Description:?\*\*\s*(.+)/i);
    const catM = block.match(/\*\*Category:?\*\*\s*(.+)/i);
    const diffM = block.match(/\*\*Difficulty:?\*\*\s*(.+)/i);
    const hoursM = block.match(/\*\*(?:Estimated\s*)?Hours?:?\*\*\s*([\d.]+)/i);
    if (titleM) {
      ideas.push({
        title: titleM[1].replace(/\*\*/g, "").trim().slice(0, 120),
        description: (descM ? descM[1] : "").replace(/\*\*/g, "").trim(),
        category: catM ? catM[1].replace(/\*\*/g, "").trim() : "LLM & Agents",
        difficulty: diffM ? diffM[1].replace(/\*\*/g, "").trim() : "Beginner",
        estimatedHours: hoursM ? Math.min(parseFloat(hoursM[1]), 1) : 0.75,
      });
    }
  }
  return ideas;
}

// ── HTML (the single-page app) ─────────────────────────────────────────────
// Theme: AI-Lab-Spinner-Wheel (light canvas, cyan/purple/pink gradients)
// Audio: innovation-wheel Web Audio sound engine
// Idea model + AI brainstorm: ai-labs-idea-spinner
// Date capture + "Available · date": spinner

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Idea Wheel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Questrial&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --cyan:#22D3EE; --purple:#A655F7; --pink:#FF5BAA;
    --grad:linear-gradient(110deg,#FF5BAA 0%,#A655F7 50%,#22D3EE 100%);
    --grad-btn:linear-gradient(135deg,#A655F7 0%,#22D3EE 100%);
    --grad-word:linear-gradient(90deg,#22D3EE 0%,#A655F7 52%,#FF5BAA 100%);
    --canvas:#FAF8F4; --panel:#FEFCF8; --panel-line:rgba(20,16,30,.07);
    --ink:#16121f; --ink-2:#4a4658; --ink-3:#9591a1;
    --bg-a:#fdeef6; --bg-c:#eef5fc;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:var(--canvas); color:var(--ink);
    font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    font-size:16px; line-height:1.5; position:relative; overflow-x:hidden;
    -webkit-font-smoothing:antialiased;
  }
  .orb{position:fixed;border-radius:50%;filter:blur(60px);opacity:.5;pointer-events:none;z-index:0}
  .orb-1{width:520px;height:520px;top:-160px;left:50%;transform:translateX(-50%);
    background:radial-gradient(circle at 50% 50%,rgba(166,85,247,.45),rgba(34,211,238,.28) 45%,transparent 70%)}
  .orb-2{width:360px;height:360px;bottom:-120px;left:-80px;
    background:radial-gradient(circle at 50% 50%,rgba(255,91,170,.35),transparent 68%)}
  .wrap{position:relative;z-index:1;max-width:880px;margin:0 auto;padding:34px 22px 64px}

  header.top{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;margin-bottom:22px}
  .wordmark{font-family:Questrial;font-size:24px;letter-spacing:-.02em;color:var(--ink)}
  .eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:600;
    letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3)}
  .eyebrow .sep{color:#cfc9d6;margin:0 8px}
  h1.title{font-family:Questrial;font-weight:400;font-size:clamp(30px,5.4vw,46px);line-height:1.12;
    letter-spacing:-.03em;margin:6px 0 0;text-wrap:balance}
  .grad{background:var(--grad-word);-webkit-background-clip:text;background-clip:text;color:transparent}
  .lede{color:var(--ink-2);max-width:44ch;margin:4px auto 0;text-wrap:pretty}

  nav.tabs{display:flex;gap:26px;justify-content:center;margin:26px 0 30px;border-bottom:1px solid var(--panel-line)}
  .tab{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px;font-weight:600;
    letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);background:none;border:none;
    padding:0 2px 12px;cursor:pointer;position:relative;transition:color .18s}
  .tab:hover{color:var(--ink-2)}
  .tab[aria-selected="true"]{color:var(--ink)}
  .tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;
    border-radius:2px;background:var(--grad-word)}
  .tab:focus-visible{outline:2px solid var(--purple);outline-offset:3px;border-radius:3px}

  .view{display:none}
  .view.on{display:block;animation:fade .3s ease}
  @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

  /* dial */
  .stage{display:flex;flex-direction:column;align-items:center;gap:26px}
  .dial-shell{width:min(380px,88vw);filter:drop-shadow(0 26px 46px rgba(120,60,180,.18))}
  .dial{width:100%;height:auto;display:block}
  .seg-label{fill:#fff;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;
    font-size:12px;paint-order:stroke;stroke:rgba(22,18,31,.22);stroke-width:.6px}
  .lamp{fill:#e7dff0;transition:fill .3s}
  .lamp.lit{fill:var(--purple);animation:glow 1.2s ease-in-out infinite}
  @keyframes glow{0%,100%{filter:drop-shadow(0 0 2px var(--purple))}50%{filter:drop-shadow(0 0 11px var(--purple))}}

  .controls{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:96px}
  .hint{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px;color:var(--ink-3);letter-spacing:.03em;margin:0}
  .btn{font-family:Inter;font-weight:600;font-size:15px;border:none;border-radius:11px;
    padding:14px 26px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;
    transition:transform .12s,box-shadow .2s,border-color .2s,background .2s}
  .btn:focus-visible{outline:2px solid var(--purple);outline-offset:3px}
  .btn-grad{background:var(--grad-btn);color:#fff;box-shadow:0 8px 22px rgba(120,60,200,.26)}
  .btn-grad:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 28px rgba(120,60,200,.32)}
  .btn-grad:disabled{background:#e6e1ea;color:#b3adbd;box-shadow:none;cursor:not-allowed}
  .btn-dark{background:var(--ink);color:#fff;font-size:13.5px;padding:12px 20px}
  .btn-dark:hover{transform:translateY(-2px)}
  .btn-ghost{background:transparent;color:var(--ink-2);border:1px solid var(--panel-line);font-size:13.5px;padding:12px 20px}
  .btn-ghost:hover{border-color:rgba(166,85,247,.35);color:var(--ink)}
  .btn-danger{color:#c0447a;border:1px solid rgba(192,68,122,.22)}
  .btn-danger:hover{border-color:rgba(192,68,122,.5);color:#a83768}

  .locked{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:520px}
  .locked .kk{color:var(--purple)}
  .locked h2{font-family:Questrial;font-weight:400;font-size:26px;line-height:1.15;letter-spacing:-.02em;margin:0}
  .locked .note{color:var(--ink-2);margin:0}
  .locked .meta-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center}
  .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px}

  .status-pill{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px}
  .status-pill.active{color:var(--purple);background:rgba(166,85,247,.1)}
  .status-pill.completed{color:#0f9bb0;background:rgba(34,211,238,.12)}
  .cat-tag{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.5px;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);padding:3px 8px;border-radius:8px;color:#fff}

  /* submit form */
  .card{background:var(--panel);border:1px solid var(--panel-line);border-radius:20px;padding:26px}
  .field-l{display:block;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:600;
    letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3);margin:18px 0 8px}
  .field-l:first-child{margin-top:0}
  .field-l .opt{color:#c3bdcc}
  .field{width:100%;background:#fff;border:1px solid var(--panel-line);border-radius:12px;
    color:var(--ink);font-family:Inter;font-size:15px;padding:13px 15px;transition:border-color .18s,box-shadow .18s}
  .field::placeholder{color:#b7b1c0}
  .field:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(166,85,247,.12)}
  textarea.field{resize:vertical;min-height:80px}
  select.field{cursor:pointer;appearance:none;-webkit-appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%239591a1' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;font-weight:600;letter-spacing:.12em;
    text-transform:uppercase;color:var(--ink-2);background:var(--panel);border:1px solid var(--panel-line);
    padding:7px 12px;border-radius:12px;cursor:pointer;transition:all .16s}
  .chip:hover{border-color:rgba(166,85,247,.3)}
  .chip[aria-pressed="true"]{background:var(--purple);border-color:var(--purple);color:#fff}
  .chip:focus-visible{outline:2px solid var(--purple);outline-offset:2px}
  .submit-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:24px}
  .anon{font-size:13px;color:var(--ink-3)}
  .flash{margin-top:14px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;
    letter-spacing:.03em;color:var(--purple)}

  /* pool / ideas list */
  .specimens{list-style:none;display:flex;flex-direction:column;gap:10px}
  .spec{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"idx body meta" ". actions actions";
    gap:6px 14px;align-items:start;background:var(--panel);border:1px solid var(--panel-line);
    border-radius:14px;padding:15px 18px;transition:transform .2s,box-shadow .2s,border-color .2s}
  .spec:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(120,60,180,.08);border-color:rgba(166,85,247,.2)}
  .spec.completed{opacity:.6}
  .spec .idx{grid-area:idx;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;color:#c3bdcc;padding-top:2px}
  .spec .body{grid-area:body;min-width:0}
  .spec .t{font-weight:600;line-height:1.35}
  .spec.completed .t{text-decoration:line-through}
  .spec .n{font-size:13px;color:var(--ink-2);margin-top:3px}
  .spec .meta{grid-area:meta;display:flex;align-items:center;gap:9px;padding-top:2px}
  .spec .date{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;color:var(--ink-3);letter-spacing:.04em}
  .spec .actions{grid-area:actions;display:flex;gap:16px}
  .mini{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.04em;
    color:var(--ink-3);background:none;border:none;padding:0;cursor:pointer;transition:color .15s}
  .mini:hover{color:var(--ink)}
  .mini.danger:hover{color:#c0447a}
  .pool-foot{display:flex;justify-content:center;margin-top:22px;gap:10px;flex-wrap:wrap;align-items:center}
  .empty{text-align:center;color:var(--ink-2);padding:40px 16px}
  .empty a{color:var(--purple);font-weight:600;cursor:pointer}

  /* brainstorm panel */
  .ai-panel{background:var(--panel);border:1px solid var(--panel-line);border-radius:20px;padding:24px;margin-bottom:24px}
  .ai-panel h2{font-family:Questrial;font-weight:400;font-size:22px;margin-bottom:4px}
  .ai-panel .sub{font-size:13px;color:var(--ink-3);margin-bottom:16px}
  .ai-input{display:flex;gap:10px;flex-wrap:wrap}
  .ai-input .field{flex:1;min-width:200px}
  .preset-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .preset{font-size:11px;padding:6px 10px;border-radius:10px;background:var(--panel);border:1px solid var(--panel-line);
    color:var(--ink-2);cursor:pointer;transition:all .16s}
  .preset:hover{border-color:rgba(166,85,247,.3);color:var(--ink)}
  .ai-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:16px}
  .ai-card{background:var(--panel);border:1px solid var(--panel-line);border-radius:14px;padding:14px;display:flex;
    flex-direction:column;justify-content:space-between;gap:10px}
  .ai-card .cat{display:inline-block;padding:3px 8px;border-radius:6px;font-size:9px;font-weight:700;color:#fff;
    font-family:"JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase}
  .ai-card .diff{font-size:10px;color:var(--ink-3);font-family:"JetBrains Mono",monospace}
  .ai-card h4{font-size:14px;font-weight:600;line-height:1.3}
  .ai-card p{font-size:12px;color:var(--ink-2);line-height:1.4}
  .ai-card .add-btn{font-size:12px;padding:8px;border-radius:9px;border:none;cursor:pointer;
    background:var(--grad-btn);color:#fff;font-weight:600;transition:transform .12s}
  .ai-card .add-btn:hover{transform:translateY(-1px)}
  .ai-card .add-btn.added{background:#e6f7ed;color:#0a7;border:1px solid #ae}

  /* hall of fame */
  .fame-item{background:var(--panel);border:1px solid var(--panel-line);border-radius:14px;padding:16px 18px;
    display:flex;flex-direction:column;gap:8px;transition:transform .2s,box-shadow .2s}
  .fame-item:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(120,60,180,.06)}
  .fame-item .top-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

  .conn{position:fixed;bottom:14px;right:16px;z-index:2;font-family:"JetBrains Mono",ui-monospace,monospace;
    font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);display:flex;align-items:center;gap:6px}
  .dot{width:7px;height:7px;border-radius:50%;background:#8bd88b}
  .conn.bad .dot{background:#e08a8a}
  .audio-toggle{position:fixed;bottom:14px;left:16px;z-index:2;font-family:"JetBrains Mono",ui-monospace,monospace;
    font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);
    background:var(--panel);border:1px solid var(--panel-line);border-radius:10px;padding:6px 10px;
    cursor:pointer;display:flex;align-items:center;gap:6px;transition:border-color .16s}
  .audio-toggle:hover{border-color:rgba(166,85,247,.35)}

  @media (max-width:520px){
    .spec{grid-template-columns:auto 1fr;grid-template-areas:"idx body" "idx meta" "idx actions"}
    nav.tabs{gap:18px}
    .ai-input{flex-direction:column}
  }
  @media (prefers-reduced-motion:reduce){
    .lamp.lit{animation:none;filter:drop-shadow(0 0 8px var(--purple))}
    .view.on{animation:none}
  }
</style>
</head>
<body>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>

<div class="wrap">
  <header class="top">
    <div class="wordmark">possibl.ai</div>
    <div class="eyebrow">AI Lab<span class="sep">/</span>Idea Wheel</div>
    <h1 class="title">Spin up what we <span class="grad">build next</span></h1>
    <p class="lede">Drop an AI idea in the box any time. Then spin the wheel.</p>
  </header>

  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" data-view="dial" aria-selected="true">Dial</button>
    <button class="tab" role="tab" data-view="submit" aria-selected="false">Submit</button>
    <button class="tab" role="tab" data-view="brainstorm" aria-selected="false">Brainstorm</button>
    <button class="tab" role="tab" data-view="pool" aria-selected="false">Pool</button>
    <button class="tab" role="tab" data-view="fame" aria-selected="false">Hall of Fame</button>
  </nav>

  <!-- ── Dial view ── -->
  <section class="view on" id="view-dial">
    <div class="stage">
      <div class="dial-shell">
        <svg class="dial" viewBox="0 0 400 400" role="img" aria-label="Idea selection dial">
          <circle cx="200" cy="200" r="196" fill="#FEFCF8"/>
          <circle cx="200" cy="200" r="191" fill="none" stroke="rgba(20,16,30,.07)" stroke-width="10"/>
          <g id="plate" style="transform-origin:200px 200px"></g>
          <circle cx="200" cy="200" r="33" fill="#FEFCF8" stroke="rgba(20,16,30,.08)" stroke-width="1.5"/>
          <circle cx="200" cy="200" r="9" fill="url(#hub)"/>
          <defs>
            <linearGradient id="hub" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#A655F7"/><stop offset="1" stop-color="#22D3EE"/>
            </linearGradient>
          </defs>
          <g id="ptr">
            <circle class="lamp" id="lamp" cx="200" cy="19" r="8"/>
            <path d="M200 50 L189 22 L211 22 Z" fill="url(#hub)"/>
          </g>
        </svg>
      </div>
      <div class="controls" id="controls"></div>
    </div>
  </section>

  <!-- ── Submit view ── -->
  <section class="view" id="view-submit">
    <div class="card">
      <label class="field-l" for="idea-title">Idea title <span class="opt">(required)</span></label>
      <input id="idea-title" class="field" maxlength="120" placeholder="e.g. Real-time multimodal voice translator">

      <label class="field-l" for="idea-desc">Short description <span class="opt">(optional)</span></label>
      <textarea id="idea-desc" class="field" maxlength="500" placeholder="What will attendees build, test, or learn?"></textarea>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label class="field-l" for="idea-cat">Category</label>
          <select id="idea-cat" class="field"></select>
        </div>
        <div>
          <label class="field-l" for="idea-diff">Difficulty</label>
          <select id="idea-diff" class="field">
            <option>Beginner</option><option selected>Intermediate</option>
            <option>Advanced</option><option>Expert</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <label class="field-l" for="idea-hours">Estimated hours (max 1)</label>
          <select id="idea-hours" class="field">
            <option value="0.5">30m</option>
            <option value="0.75" selected>45m</option>
            <option value="1">60m</option>
          </select>
        </div>
        <div>
          <label class="field-l" for="idea-tag">Tag <span class="opt">(optional)</span></label>
          <input id="idea-tag" class="field" maxlength="40" placeholder="e.g. Voice, RAG, Agents">
        </div>
      </div>

      <div class="submit-foot">
        <button class="btn btn-grad" id="addBtn" disabled>Add to the wheel</button>
        <span class="anon">No names collected. Fully anonymous.</span>
      </div>
      <div class="flash" id="flash"></div>
    </div>
  </section>

  <!-- ── Brainstorm view ── -->
  <section class="view" id="view-brainstorm">
    <div class="ai-panel">
      <h2>AI Brainstorm Assistant</h2>
      <div class="sub">Powered by the RCRT agent pipeline — generates hands-on AI Lab session ideas you can add to the wheel.</div>
      <div class="ai-input">
        <input id="brain-topic" class="field" placeholder="Type focus area (e.g. Autonomous Coding, Multimodal RAG)..." maxlength="120">
        <button class="btn btn-grad" id="brainBtn">Brainstorm Ideas</button>
      </div>
      <div class="preset-row" id="presetRow"></div>
      <div id="brain-status" class="flash" style="margin-top:14px"></div>
      <div class="ai-results" id="aiResults"></div>
    </div>
  </section>

  <!-- ── Pool view ── -->
  <section class="view" id="view-pool">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <h2 style="font-family:Questrial;font-weight:400;font-size:24px">Idea Pool</h2>
      <div id="poolCounts" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-3);letter-spacing:.04em"></div>
    </div>
    <div id="poolBody"></div>
  </section>

  <!-- ── Hall of Fame view ── -->
  <section class="view" id="view-fame">
    <div style="text-align:center;margin-bottom:24px">
      <h2 style="font-family:Questrial;font-weight:400;font-size:28px">Hall of Fame</h2>
      <p class="lede" style="margin-top:6px">Ideas the wheel selected and the team shipped.</p>
    </div>
    <div id="fameBody"></div>
  </section>
</div>

<div class="audio-toggle" id="audioToggle" title="Toggle sound effects"><span id="audioIcon">&#128266;</span><span id="audioLabel">Sound on</span></div>
<div class="conn" id="conn"><span class="dot"></span><span id="connText">Connected</span></div>

<!-- confetti canvas -->
<canvas id="confettiCanvas" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999"></canvas>

<script>
const API = "/api";
const CATEGORIES = ["LLM & Agents","Computer Vision","Audio & Multimodal","Automation & RAG","Creative AI & Gaming","Fun & Experimental"];
const CAT_COLORS = ${JSON.stringify(CATEGORY_COLORS)};
const SEG = ["#FF5BAA","#D65BC9","#A655F7","#7B6FF9","#4C9EF3","#22D3EE"];
const PRESET_TOPICS = ["Agentic Workflows & Tool Use","Real-Time Multimodal Voice & Audio","Vision AI & Image Processing","RAG & Local Vector Document Search","AI Game Mechanics & Pixel Art","Automated Code Generation & Testing"];

let ideas = [];
let view = "dial";
let rotation = 0;
let spinning = false;
let winnerId = null;
let frozen = [];
let soundOn = true;
let brainstorming = false;
let brainGenerated = [];
let brainImported = {};
const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (s) => document.querySelector(s);
const active = () => ideas.filter(i => i.status === "active");
const esc = (s) => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&","<":"<",">":">",'"':""","'":"&#39;"}[c]));
const trunc = (s,n) => s && s.length>n ? s.slice(0,n-1)+"\\u2026" : (s||"");
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); } catch { return ""; } };

// ── populate category dropdown ──
const catSel = $("#idea-cat");
CATEGORIES.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o); });

// ── populate preset topics ──
const presetRow = $("#presetRow");
PRESET_TOPICS.forEach(t => {
  const b = document.createElement("button");
  b.className = "preset"; b.type = "button"; b.textContent = t;
  b.onclick = () => { $("#brain-topic").value = t; doBrainstorm(t); };
  presetRow.appendChild(b);
});

// ── SVG dial drawing (AI-Lab-Spinner-Wheel style) ──
function ptTopCW(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function slice(cx,cy,r,s,e){const[sx,sy]=ptTopCW(cx,cy,r,s);const[ex,ey]=ptTopCW(cx,cy,r,e);
  const big=e-s>180?1:0;return "M "+cx+" "+cy+" L "+sx.toFixed(2)+" "+sy.toFixed(2)+" A "+r+" "+r+" 0 "+big+" 1 "+ex.toFixed(2)+" "+ey.toFixed(2)+" Z";}

function drawPlate(){
  const list = spinning ? frozen : active();
  const plate = $("#plate");
  plate.style.transition = "none";
  plate.style.transform = "rotate("+rotation+"deg)";
  const n = list.length;
  if(n===0){ plate.innerHTML = '<circle cx="200" cy="200" r="170" fill="#f3eef7" stroke="rgba(20,16,30,.06)" stroke-width="1.5"/>'; return; }
  if(n===1){
    plate.innerHTML = '<circle cx="200" cy="200" r="170" fill="'+SEG[0]+'"/>'+
      '<text x="200" y="92" text-anchor="middle" class="seg-label">'+esc(trunc(list[0].title,20))+'</text>';
    return;
  }
  const seg = 360/n;
  let out = "";
  list.forEach((idea,i) => {
    const s = i*seg, e = (i+1)*seg, mid = s + seg/2;
    const [lx,ly] = ptTopCW(200,200,112,mid);
    const fs = Math.max(8, 13 - Math.max(0,n-8)*0.4);
    const color = idea.color || SEG[i%SEG.length];
    out += '<path d="'+slice(200,200,170,s,e)+'" fill="'+color+'" stroke="#FAF8F4" stroke-width="2"/>';
    out += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle" dominant-baseline="middle" class="seg-label" style="font-size:'+fs+'px">'+esc(trunc(idea.title, n>12?10:15))+'</text>';
  });
  plate.innerHTML = out;
}

function drawControls(){
  const c = $("#controls");
  const w = winnerId ? ideas.find(i => i.id === winnerId) : null;
  $("#lamp").classList.toggle("lit", !!w);
  if(w){
    const dateStr = w.completedAt ? fmtDate(w.completedAt) : "";
    c.innerHTML =
      '<div class="locked">'+
        '<span class="eyebrow kk">Locked in</span>'+
        '<h2>'+esc(w.title)+'</h2>'+
        '<div class="meta-row">'+
          (w.category?'<span class="cat-tag" style="background:'+(w.color||SEG[0])+'">'+esc(w.category)+'</span>':'')+
          '<span class="status-pill active">'+esc(w.difficulty||'')+' &middot; '+(w.estimatedHours||0.75)+'h</span>'+
        '</div>'+
        (w.description?'<p class="note">'+esc(w.description)+'</p>':'')+
        (dateStr?'<p class="note" style="font-family:JetBrains Mono,monospace;font-size:11px">Completed '+esc(dateStr)+'</p>':'')+
        '<div class="row">'+
          '<button class="btn btn-dark" id="buildBtn">Mark as built</button>'+
          '<button class="btn btn-ghost" id="againBtn">Spin again</button>'+
        '</div>'+
      '</div>';
    $("#buildBtn").onclick = () => markBuilt(w.id);
    $("#againBtn").onclick = () => { winnerId = null; drawControls(); };
  } else {
    const n = active().length;
    c.innerHTML =
      '<button class="btn btn-grad" id="spinBtn"'+(n<2?' disabled':'')+'>Spin the wheel</button>'+
      '<p class="hint">'+(n<2?("Need at least 2 ideas in the pool. "+n+" so far."):(n+" ideas loaded. Give it a spin."))+'</p>';
    if(n>=2) $("#spinBtn").onclick = spin;
  }
}

// ── Spin (innovation-wheel game-show cycle + sound) ──
function spin(){
  const list = active();
  if(spinning || list.length < 2) return;
  winnerId = null;
  frozen = list.slice();
  spinning = true;
  const idx = Math.floor(Math.random()*list.length);
  const seg = 360/list.length;
  const targetCenter = idx*seg + seg/2;
  const curMod = ((rotation%360)+360)%360;
  const desired = ((360-targetCenter)%360+360)%360;
  let delta = ((desired-curMod)%360+360)%360;
  delta += 360*(reduce?0:(5+Math.floor(Math.random()*3)));
  if(delta===0) delta = 360;
  const dur = reduce ? 320 : 4600;
  drawControls();
  const plate = $("#plate");
  plate.style.transition = "transform "+dur+"ms cubic-bezier(.12,.72,.09,1)";
  rotation += delta;
  plate.style.transform = "rotate("+rotation+"deg)";

  // sound: rapid ticks then slow thuds
  if(soundOn && !reduce){
    let tickCount = 0;
    const totalTicks = 40;
    const tickLoop = () => {
      if(tickCount >= totalTicks) return;
      if(tickCount < totalTicks - 8) sfx.tick(600 + (tickCount % 5) * 80);
      else sfx.thud();
      const delay = tickCount < totalTicks - 8 ? 40 + (tickCount > 8 ? tickCount * 2 : 0) : 200 + (tickCount - (totalTicks-8)) * 80;
      tickCount++;
      setTimeout(tickLoop, delay);
    };
    tickLoop();
  }

  setTimeout(() => {
    spinning = false;
    const chosen = frozen[idx];
    winnerId = chosen.id;
    drawPlate();
    drawControls();
    if(soundOn) sfx.fanfare();
    if(!reduce) confettiBurst();
    recordSpin(chosen);
  }, dur + 70);
}

// ── Web Audio sound engine (from innovation-wheel) ──
const sfx = {
  ctx: null,
  init(){ if(!this.ctx){ const AC = window.AudioContext || window.webkitAudioContext; if(AC) this.ctx = new AC(); } if(this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  tick(freq=800, dur=0.03){ if(!soundOn) return; try { this.init(); if(!this.ctx) return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="triangle"; o.frequency.setValueAtTime(freq,this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(120,this.ctx.currentTime+dur); g.gain.setValueAtTime(0.25,this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+dur); } catch {} },
  thud(){ if(!soundOn) return; try { this.init(); if(!this.ctx) return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="sine"; o.frequency.setValueAtTime(160,this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40,this.ctx.currentTime+0.2); g.gain.setValueAtTime(0.5,this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,this.ctx.currentTime+0.2); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+0.2); } catch {} },
  fanfare(){ if(!soundOn) return; try { this.init(); if(!this.ctx) return; const now=this.ctx.currentTime; const notes=[523.25,659.25,783.99,1046.50]; notes.forEach((f,i)=>{ const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="square"; o.frequency.setValueAtTime(f,now+i*0.08); g.gain.setValueAtTime(0,now+i*0.08); g.gain.linearRampToValueAtTime(0.2,now+i*0.08+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+i*0.08+0.6); o.connect(g); g.connect(this.ctx.destination); o.start(now+i*0.08); o.stop(now+i*0.08+0.6); }); } catch {} },
  ding(){ if(!soundOn) return; try { this.init(); if(!this.ctx) return; const now=this.ctx.currentTime; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="sine"; o.frequency.setValueAtTime(987.77,now); o.frequency.setValueAtTime(1318.51,now+0.1); g.gain.setValueAtTime(0.3,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.8); o.connect(g); g.connect(this.ctx.destination); o.start(now); o.stop(now+0.8); } catch {} },
  click(){ if(!soundOn) return; try { this.init(); if(!this.ctx) return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type="sine"; o.frequency.setValueAtTime(440,this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880,this.ctx.currentTime+0.08); g.gain.setValueAtTime(0.2,this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,this.ctx.currentTime+0.08); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+0.08); } catch {} },
};

// ── Confetti (innovation-wheel style) ──
function confettiBurst(){
  const cv = $("#confettiCanvas");
  const cx = cv.getContext("2d");
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const colors = ["#FF5BAA","#A655F7","#22D3EE","#FFD93D","#6BCB77"];
  const particles = [];
  for(let i=0;i<120;i++){ particles.push({ x:cv.width/2, y:cv.height/2, vx:(Math.random()-0.5)*16, vy:Math.random()*-16-4, g:0.4, c:colors[i%colors.length], s:Math.random()*6+3, life:80 }); }
  let frame = 0;
  function step(){
    frame++;
    cx.clearRect(0,0,cv.width,cv.height);
    let alive = false;
    for(const p of particles){
      if(p.life <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
      cx.fillStyle = p.c; cx.fillRect(p.x, p.y, p.s, p.s);
    }
    if(alive && frame < 120) requestAnimationFrame(step);
    else cx.clearRect(0,0,cv.width,cv.height);
  }
  step();
}

// ── API calls ──
async function api(method, path, body){
  const opt = { method, headers: {} };
  if(body){ opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  const res = await fetch(API + path, opt);
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.error || "HTTP "+res.status); }
  return res.status === 204 ? null : res.json();
}

async function load(){
  try { ideas = await api("GET","/ideas"); setConn(true); }
  catch(e){ setConn(false); }
  if(view === "dial" && !spinning) drawPlate();
  if(view === "dial") drawControls();
  if(view === "pool") renderPool();
  if(view === "fame") renderFame();
  syncTabCount();
}

function setConn(ok){ const c = $("#conn"); c.classList.toggle("bad",!ok); $("#connText").textContent = ok ? "Connected" : "Offline"; }

function syncTabCount(){
  const t = document.querySelector('.tab[data-view="pool"]');
  const n = active().length;
  t.textContent = n > 0 ? "Pool \\u00b7 "+n : "Pool";
}

// ── record spin event to backend ──
async function recordSpin(idea){
  try { await api("POST","/spin", { id: idea.id, title: idea.title, totalEligible: frozen.length }); }
  catch(e){ console.error("spin record failed:", e); }
}

// ── mark built (completion flow) ──
async function markBuilt(id){
  try {
    const updated = await api("POST","/complete", { id });
    const idx = ideas.findIndex(i => i.id === id);
    if(idx >= 0) ideas[idx] = updated;
    winnerId = null;
    if(soundOn) sfx.ding();
    drawPlate(); drawControls(); syncTabCount();
    if(view === "pool") renderPool();
    if(view === "fame") renderFame();
  } catch(e){ console.error("complete failed:", e); alert("Failed to mark as built: "+e.message); }
}

// ── submit form ──
const titleInput = $("#idea-title");
const descInput = $("#idea-desc");
const addBtn = $("#addBtn");
const flashEl = $("#flash");

function checkAddBtn(){ addBtn.disabled = !titleInput.value.trim(); }
titleInput.addEventListener("input", checkAddBtn);
titleInput.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); submitIdea(); } });

async function submitIdea(){
  const title = titleInput.value.trim();
  if(!title) return;
  const idea = {
    title,
    description: descInput.value.trim(),
    category: catSel.value,
    difficulty: $("#idea-diff").value,
    estimatedHours: parseFloat($("#idea-hours").value),
    tag: $("#idea-tag").value.trim(),
  };
  addBtn.disabled = true;
  if(soundOn) sfx.click();
  try {
    const created = await api("POST","/idea", idea);
    ideas.push(created);
    titleInput.value = ""; descInput.value = ""; $("#idea-tag").value = "";
    flashEl.textContent = "Dropped in the wheel, anonymously.";
    setTimeout(()=>{ flashEl.textContent = ""; }, 2600);
    syncTabCount();
    if(view === "dial"){ drawPlate(); drawControls(); }
    if(view === "pool") renderPool();
  } catch(e){
    flashEl.textContent = "Error: " + e.message;
  } finally {
    checkAddBtn();
  }
}
addBtn.onclick = submitIdea;

// ── brainstorm (RCRT agent) ──
const brainBtn = $("#brainBtn");
const brainTopic = $("#brain-topic");
const brainStatus = $("#brain-status");
const aiResults = $("#aiResults");

brainTopic.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); doBrainstorm(); } });
brainBtn.onclick = () => doBrainstorm();

async function doBrainstorm(topic){
  if(brainstorming) return;
  const t = (topic || brainTopic.value || "").trim();
  brainstorming = true;
  brainBtn.disabled = true;
  brainStatus.textContent = "Brainstorming via RCRT agent...";
  aiResults.innerHTML = "";
  try {
    const data = await api("POST","/brainstorm", { topic: t });
    brainGenerated = data.ideas || [];
    brainImported = {};
    brainStatus.textContent = brainGenerated.length + " ideas generated. Add the ones you like to the wheel.";
    renderBrainResults();
  } catch(e){
    brainStatus.textContent = "Error: " + e.message;
  } finally {
    brainstorming = false;
    brainBtn.disabled = false;
  }
}

function renderBrainResults(){
  if(brainGenerated.length === 0){ aiResults.innerHTML = ""; return; }
  aiResults.innerHTML = brainGenerated.map((item, i) => {
    const color = CAT_COLORS[item.category] || "#A655F7";
    return '<div class="ai-card">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'+
        '<span class="cat" style="background:'+color+'">'+esc(item.category||"AI")+'</span>'+
        '<span class="diff">'+esc(item.difficulty||"")+' &middot; '+(item.estimatedHours||0.75)+'h</span>'+
      '</div>'+
      '<div><h4>'+esc(item.title)+'</h4><p>'+esc(item.description||"")+'</p></div>'+
      '<button class="add-btn'+(brainImported[i]?' added':'')+'" data-idx="'+i+'">'+(brainImported[i]?"\\u2713 Added to wheel":"Add to wheel")+'</button>'+
    '</div>';
  }).join("");
  aiResults.querySelectorAll(".add-btn").forEach(btn => {
    btn.onclick = () => importBrainIdea(parseInt(btn.dataset.idx));
  });
}

async function importBrainIdea(idx){
  const item = brainGenerated[idx];
  if(!item || brainImported[idx]) return;
  try {
    const created = await api("POST","/idea", {
      title: item.title,
      description: item.description,
      category: item.category || "LLM & Agents",
      difficulty: item.difficulty || "Beginner",
      estimatedHours: Math.min(item.estimatedHours || 0.75, 1),
      tag: (item.tags && item.tags[0]) || "AIBrainstorm",
    });
    ideas.push(created);
    brainImported[idx] = true;
    if(soundOn) sfx.click();
    syncTabCount();
    if(view === "dial"){ drawPlate(); drawControls(); }
    renderBrainResults();
  } catch(e){ alert("Failed to add: "+e.message); }
}

// ── pool view ──
function renderPool(){
  const b = $("#poolBody");
  const activeCount = active().length;
  const completedCount = ideas.filter(i => i.status === "completed").length;
  $("#poolCounts").textContent = activeCount + " active / " + completedCount + " built / " + ideas.length + " total";

  if(ideas.length === 0){
    b.innerHTML = '<div class="empty">The wheel is empty. Head to <a id="goSubmit">Submit</a> or <a id="goBrain">Brainstorm</a> to add the first idea.</div>';
    const gs = $("#goSubmit"); if(gs) gs.onclick = () => setView("submit");
    const gb = $("#goBrain"); if(gb) gb.onclick = () => setView("brainstorm");
    return;
  }
  let rows = "";
  ideas.forEach((idea, i) => {
    const built = idea.status === "completed";
    const color = idea.color || CAT_COLORS[idea.category] || "#A655F7";
    rows += '<li class="spec'+(built?' completed':'')+'">'+
      '<span class="idx">'+String(i+1).padStart(2,"0")+'</span>'+
      '<div class="body"><div class="t">'+esc(idea.title)+'</div>'+
        (idea.description?'<div class="n">'+esc(idea.description)+'</div>':'')+'</div>'+
      '<div class="meta">'+
        (idea.category?'<span class="cat-tag" style="background:'+color+'">'+esc(idea.category)+'</span>':'')+
        '<span class="status-pill '+(built?'completed':'active')+'">'+(built?'Built':'Available')+'</span>'+
        '<span class="date">'+(built && idea.completedAt?('Built '+fmtDate(idea.completedAt)):('Added '+fmtDate(idea.createdAt)))+'</span>'+
      '</div>'+
      '<div class="actions">'+
        (built?'<button class="mini" data-act="restore" data-id="'+idea.id+'">restore</button>'
              :'<button class="mini" data-act="complete" data-id="'+idea.id+'">mark built</button>')+
        '<button class="mini danger" data-act="remove" data-id="'+idea.id+'">remove</button>'+
      '</div></li>';
  });
  b.innerHTML = '<ul class="specimens">'+rows+'</ul>'+
    '<div class="pool-foot"><button class="btn btn-ghost btn-danger" id="clearBtn">Clear all</button></div>';
  b.querySelectorAll(".mini").forEach(btn => { btn.onclick = () => poolAction(btn.dataset.act, btn.dataset.id); });
  $("#clearBtn").onclick = confirmClear;
}

async function poolAction(act, id){
  if(act === "remove"){
    ideas = ideas.filter(i => i.id !== id);
    if(winnerId === id) winnerId = null;
    renderPool(); syncTabCount();
    if(view === "dial"){ drawPlate(); drawControls(); }
    try { await api("DELETE","/idea/"+id); } catch(e){ setConn(false); }
  } else if(act === "complete"){
    try {
      const updated = await api("POST","/complete", { id });
      const idx = ideas.findIndex(i => i.id === id);
      if(idx >= 0) ideas[idx] = updated;
      renderPool(); syncTabCount();
      if(view === "dial"){ drawPlate(); drawControls(); }
      if(soundOn) sfx.ding();
    } catch(e){ alert("Failed: "+e.message); }
  } else if(act === "restore"){
    try {
      const updated = await api("POST","/restore", { id });
      const idx = ideas.findIndex(i => i.id === id);
      if(idx >= 0) ideas[idx] = updated;
      renderPool(); syncTabCount();
      if(view === "dial"){ drawPlate(); drawControls(); }
    } catch(e){ alert("Failed: "+e.message); }
  }
}

function confirmClear(){
  const foot = $(".pool-foot");
  foot.innerHTML = '<span class="hint">Remove every idea for everyone?</span>'+
    '<button class="btn btn-dark" id="yesClear">Yes, clear it</button>'+
    '<button class="btn btn-ghost" id="noClear">Cancel</button>';
  $("#noClear").onclick = renderPool;
  $("#yesClear").onclick = async () => {
    ideas = []; winnerId = null; renderPool(); syncTabCount();
    if(view === "dial"){ drawPlate(); drawControls(); }
    try { await api("DELETE","/ideas"); } catch(e){ setConn(false); }
  };
}

// ── hall of fame view ──
function renderFame(){
  const b = $("#fameBody");
  const completed = ideas.filter(i => i.status === "completed");
  if(completed.length === 0){
    b.innerHTML = '<div class="empty">No shipped ideas yet. Spin the wheel and mark one as built to feature it here.</div>';
    return;
  }
  b.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px">'+completed.map(idea => {
    const color = idea.color || CAT_COLORS[idea.category] || "#A655F7";
    return '<div class="fame-item">'+
      '<div class="top-row">'+
        '<span class="status-pill completed">Shipped</span>'+
        (idea.category?'<span class="cat-tag" style="background:'+color+'">'+esc(idea.category)+'</span>':'')+
        '<span class="date">'+(idea.completedAt?('Built '+fmtDate(idea.completedAt)):'')+'</span>'+
      '</div>'+
      '<h3 style="font-size:18px;font-weight:600">'+esc(idea.title)+'</h3>'+
      (idea.description?'<p style="font-size:13px;color:var(--ink-2)">'+esc(idea.description)+'</p>':'')+
    '</div>';
  }).join("")+'</div>';
}

// ── view switching ──
function setView(v){
  view = v;
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === v ? "true" : "false"));
  document.querySelectorAll(".view").forEach(s => s.classList.remove("on"));
  $("#view-"+v).classList.add("on");
  if(v === "dial"){ drawPlate(); drawControls(); }
  if(v === "pool") renderPool();
  if(v === "fame") renderFame();
}

document.querySelectorAll(".tab").forEach(t => t.onclick = () => setView(t.dataset.view));

// ── audio toggle ──
$("#audioToggle").onclick = () => {
  soundOn = !soundOn;
  $("#audioIcon").innerHTML = soundOn ? "&#128266;" : "&#128263;";
  $("#audioLabel").textContent = soundOn ? "Sound on" : "Muted";
  if(soundOn) sfx.click();
};

// ── init ──
drawPlate(); drawControls();
load();
setInterval(() => { if(!spinning && (view === "dial" || view === "pool")) load(); }, 10000);
</script>
</body>
</html>`;

// ── Server ─────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  // ── health ──
  if (req.method === "GET" && (path === "/health" || path === "/healthz")) {
    return sendJSON(res, 200, { status: "ok" });
  }

  // ── HTML page ──
  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }

  // ── GET /api/ideas — list all idea breadcrumbs ──
  if (req.method === "GET" && path === "/api/ideas") {
    try {
      const crumbs = await client.breadcrumbs.query({ tags: IDEA_TAG, limit: 1000 });
      const ideas = crumbs
        .filter((c) => !c.deleted_at)
        .map(crumbToIdea)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJSON(res, 200, { ideas });
    } catch (err) {
      console.error("GET /api/ideas error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to list ideas" });
    }
  }

  // ── POST /api/idea — create a new idea breadcrumb ──
  if (req.method === "POST" && path === "/api/idea") {
    try {
      const body = JSON.parse(await readBody(req));
      const title = (body.title || body.text || "").trim();
      if (!title) return sendJSON(res, 400, { error: "title is required" });
      if (title.length > 200) return sendJSON(res, 400, { error: "title too long (max 200)" });

      const now = new Date().toISOString();
      const category = body.category || "LLM & Agents";
      const ideaContent = {
        title,
        text: title,
        description: (body.description || "").trim(),
        category,
        difficulty: body.difficulty || "Beginner",
        estimatedHours: Math.min(parseFloat(body.estimatedHours) || 0.75, 1),
        tags: body.tag ? [body.tag] : (body.tags || ["AILab"]),
        objectives: body.objectives || [],
        status: "active",
        createdAt: now,
        completedAt: null,
        color: CATEGORY_COLORS[category] || "#A655F7",
        source: "ai-idea-wheel",
        created_by_user: RCRT_USER_ID || null,
      };

      const crumb = await client.breadcrumbs.create({
        name: `ai-idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        content: ideaContent,
        tags: [IDEA_TAG],
        upsert: false,
      });

      return sendJSON(res, 201, crumbToIdea(crumb));
    } catch (err) {
      console.error("POST /api/idea error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to save idea" });
    }
  }

  // ── DELETE /api/idea/:id — remove a single idea ──
  if (req.method === "DELETE" && path.startsWith("/api/idea/")) {
    try {
      const id = path.replace("/api/idea/", "");
      if (!id) return sendJSON(res, 400, { error: "id is required" });
      await client.breadcrumbs.delete(id);
      return sendJSON(res, 204, null);
    } catch (err) {
      console.error("DELETE /api/idea error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to delete" });
    }
  }

  // ── DELETE /api/ideas — clear all ideas (facilitator reset) ──
  if (req.method === "DELETE" && path === "/api/ideas") {
    try {
      const crumbs = await client.breadcrumbs.query({ tags: IDEA_TAG, limit: 1000 });
      for (const c of crumbs) {
        if (!c.deleted_at) {
          try { await client.breadcrumbs.delete(c.id); } catch {}
        }
      }
      return sendJSON(res, 204, null);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message || "failed to clear" });
    }
  }

  // ── POST /api/spin — record a spin event ──
  if (req.method === "POST" && path === "/api/spin") {
    try {
      const body = JSON.parse(await readBody(req));
      const now = new Date().toISOString();
      await client.breadcrumbs.create({
        name: `spin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: body.title || "Spin event",
        content: {
          type: "spin",
          selectedIdeaId: body.id,
          selectedIdeaTitle: body.title,
          totalEligible: body.totalEligible || 0,
          timestamp: now,
          performedBy: RCRT_USER_ID || "anonymous",
        },
        tags: [SPIN_TAG],
        upsert: false,
      });
      return sendJSON(res, 200, { ok: true });
    } catch (err) {
      console.error("POST /api/spin error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to record spin" });
    }
  }

  // ── POST /api/complete — mark an idea as built (captures completion date) ──
  if (req.method === "POST" && path === "/api/complete") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = body.id;
      if (!id) return sendJSON(res, 400, { error: "id is required" });

      const crumb = await client.breadcrumbs.get(id);
      const content = crumb.content || {};
      const now = new Date().toISOString();
      content.status = "completed";
      content.completedAt = now;

      const updated = await client.breadcrumbs.update(id, {
        version: crumb.version,
        content,
        tags: crumb.tags,
      });

      // Also record a completion breadcrumb for the Hall of Fame audit trail.
      try {
        await client.breadcrumbs.create({
          name: `completion-${id}-${Date.now()}`,
          title: content.title || "Completed idea",
          content: {
            type: "completion",
            ideaId: id,
            ideaTitle: content.title,
            completedAt: now,
            performedBy: RCRT_USER_ID || "anonymous",
          },
          tags: [COMPLETION_TAG],
          parent_ids: [id],
          upsert: false,
        });
      } catch (e) {
        console.error("completion breadcrumb failed:", e);
      }

      return sendJSON(res, 200, crumbToIdea(updated));
    } catch (err) {
      console.error("POST /api/complete error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to complete idea" });
    }
  }

  // ── POST /api/restore — restore a completed idea to active ──
  if (req.method === "POST" && path === "/api/restore") {
    try {
      const body = JSON.parse(await readBody(req));
      const id = body.id;
      if (!id) return sendJSON(res, 400, { error: "id is required" });

      const crumb = await client.breadcrumbs.get(id);
      const content = crumb.content || {};
      content.status = "active";
      content.completedAt = null;

      const updated = await client.breadcrumbs.update(id, {
        version: crumb.version,
        content,
        tags: crumb.tags,
      });

      return sendJSON(res, 200, crumbToIdea(updated));
    } catch (err) {
      console.error("POST /api/restore error:", err);
      return sendJSON(res, 500, { error: err.message || "failed to restore" });
    }
  }

  // ── POST /api/brainstorm — generate ideas via RCRT agent ──
  if (req.method === "POST" && path === "/api/brainstorm") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const topic = (body.topic || "").trim();
      const reply = await generateViaAgent(BRAINSTORM_PROMPT(topic));
      const parsed = parseAgentJSON(reply);

      if (Array.isArray(parsed)) {
        const ideas = parsed
          .filter((i) => i && (i.title || i.text))
          .map((i) => ({
            title: i.title || i.text || "Untitled",
            description: i.description || "",
            category: CATEGORIES.includes(i.category) ? i.category : "LLM & Agents",
            difficulty: i.difficulty || "Beginner",
            estimatedHours: Math.min(i.estimatedHours || 0.75, 1),
            tags: Array.isArray(i.tags) ? i.tags : ["AIBrainstorm"],
            objectives: Array.isArray(i.objectives) ? i.objectives : [],
          }));
        return sendJSON(res, 200, { ideas });
      }

      // Fallback: parse markdown-formatted agent reply into idea stubs.
      if (reply) {
        const mdIdeas = parseMarkdownIdeas(reply);
        if (mdIdeas.length > 0) {
          const stubs = mdIdeas.slice(0, 5).map((item) => ({
            title: item.title,
            description: item.description || "Generated by RCRT agent.",
            category: CATEGORIES.includes(item.category) ? item.category : "LLM & Agents",
            difficulty: item.difficulty || "Beginner",
            estimatedHours: item.estimatedHours || 0.75,
            tags: ["AIBrainstorm"],
            objectives: [],
          }));
          return sendJSON(res, 200, { ideas: stubs });
        }
        // Last resort: split prose lines into stub titles.
        const stubs = reply
          .split(/\n+/)
          .map((l) => l.replace(/^[\s\-*\d.\)]+/, "").replace(/\*\*/g, "").trim())
          .filter((l) => l.length > 10 && !l.match(/^(Title|Description|Category|Difficulty|Hours):/i))
          .slice(0, 5)
          .map((l) => ({
            title: l.slice(0, 120),
            description: "Generated by RCRT agent.",
            category: "LLM & Agents",
            difficulty: "Beginner",
            estimatedHours: 0.75,
            tags: ["AIBrainstorm"],
            objectives: [],
          }));
        return sendJSON(res, 200, { ideas: stubs });
      }

      return sendJSON(res, 200, { ideas: [] });
    } catch (err) {
      console.error("POST /api/brainstorm error:", err);
      return sendJSON(res, 500, { error: err.message || "brainstorm failed" });
    }
  }

  // ── POST /api/enhance — enhance a single idea via RCRT agent ──
  if (req.method === "POST" && path === "/api/enhance") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const title = (body.title || "").trim();
      if (!title) return sendJSON(res, 400, { error: "title is required" });

      const reply = await generateViaAgent(ENHANCE_PROMPT(title, body.description));
      const parsed = parseAgentJSON(reply);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const enhanced = {
          title: parsed.title || title,
          description: parsed.description || body.description || "",
          category: CATEGORIES.includes(parsed.category) ? parsed.category : "LLM & Agents",
          difficulty: parsed.difficulty || "Beginner",
          estimatedHours: Math.min(parsed.estimatedHours || 0.75, 1),
          tags: Array.isArray(parsed.tags) ? parsed.tags : ["AILab"],
          objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
        };
        return sendJSON(res, 200, enhanced);
      }

      // Fallback enhancement
      return sendJSON(res, 200, {
        title,
        description: body.description || `Fast hands-on AI Lab session exploring ${title}.`,
        category: "LLM & Agents",
        difficulty: "Beginner",
        estimatedHours: 0.75,
        tags: ["FastBuild", "AILab"],
        objectives: [`Define scope for ${title}`, "Build prototype in under 1 hour", "Demo to team"],
      });
    } catch (err) {
      console.error("POST /api/enhance error:", err);
      return sendJSON(res, 500, { error: err.message || "enhance failed" });
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
