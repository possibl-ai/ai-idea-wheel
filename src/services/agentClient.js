import { client } from "./rcrtClient.js";
import { RCRT_USER_ID, CATEGORY_COLORS } from "../config.js";

const brainstormPrompt = (topic) =>
  `Generate 3 creative, hands-on AI Lab session ideas for a weekly tech team meetup. ` +
  `Focus topic: "${topic || "General AI & fast prototyping"}". ` +
  `Each project MUST be buildable in UNDER 1 HOUR. ` +
  `DO NOT use the ask tool or memory-search tool. DO NOT ask me any questions. ` +
  `Respond IMMEDIATELY with your ideas as plain text, using this format for each idea:\n` +
  `1. **Title:** [creative title]\n   **Description:** [1-2 sentence description]\n` +
  `   **Category:** [one of: ${Object.keys(CATEGORY_COLORS).join(", ")}]\n` +
  `   **Difficulty:** [Beginner/Intermediate/Advanced/Expert]\n` +
  `   **EstimatedHours:** [0.5 or 0.75 or 1]\n` +
  `Generate exactly 3 ideas. Start with "1." immediately.`;

const enhancePrompt = (title, description) =>
  `Enhance this AI lab session idea into a quick hands-on project buildable in under 1 hour. ` +
  `Title: "${title}". Description: "${description || "none"}". ` +
  `Respond with ONLY a JSON object (no markdown, no prose) with the same schema: ` +
  `{ "title", "description", "category", "difficulty", "estimatedHours", "tags": string[], "objectives": string[] }. ` +
  `Category must be one of ${JSON.stringify(Object.keys(CATEGORY_COLORS))}.`;

export { brainstormPrompt, enhancePrompt };

export async function generateViaAgent(prompt) {
  const chatResp = await client.chat.send({
    message: prompt,
    user_id: RCRT_USER_ID || undefined,
  });

  let reply = "";
  let gotStreamComplete = false;
  let postCompleteDeadline = 0;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 60000);

  try {
    for await (const evt of client.chat.stream(chatResp.session_id, { signal: ac.signal })) {
      if (evt.type === "delta") {
        try {
          const payload = JSON.parse(evt.data);
          const chunk = payload.delta || payload.text || payload.content || "";
          if (chunk) reply += chunk;
        } catch {
          reply += evt.data || "";
        }
      } else if (evt.type === "message") {
        try {
          const payload = JSON.parse(evt.data);
          const sourceType = payload.content?.source_type;
          const finishReason = payload.content?.finish_reason;

          if (sourceType && sourceType !== "user" && finishReason !== "tool_use") {
            const agentText = payload.content?.content || payload.content?.text || "";
            if (agentText) { reply = agentText; break; }
          }
          if (finishReason === "tool_use" && payload.content?.tool_calls) {
            for (const tc of payload.content.tool_calls) {
              const toolName = tc.function?.name || "";
              if (toolName === "think" || toolName === "ask" || toolName === "respond") {
                try {
                  const args = JSON.parse(tc.function?.arguments || "{}");
                  const text = args.query || args.context || args.message || args.response || args.thought || "";
                  if (text && text.length > 20) reply = text;
                } catch {}
              }
            }
          }
          if (payload.content?.output) {
            const out = payload.content.output;
            if (typeof out === "string" && out.length > 10) {
              reply = out;
            } else if (out && typeof out === "object") {
              const msg = out.message || out.text || out.content || out.result || out.response || "";
              if (typeof msg === "string" && msg.length > 10) reply = msg;
              else if (out.context && typeof out.context === "string") reply = out.context;
            }
          }
        } catch {}
      } else if (evt.type === "stream.complete") {
        if (reply) break;
        gotStreamComplete = true;
        postCompleteDeadline = Date.now() + 20000;
      } else if (evt.type === "heartbeat") {
        if (gotStreamComplete && Date.now() > postCompleteDeadline) break;
      }
    }
  } catch {
    // abort/timeout expected
  }
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
