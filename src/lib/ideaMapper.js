import { CATEGORY_COLORS } from "../config.js";

export function crumbToIdea(c) {
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

export function parseAgentJSON(reply) {
  if (!reply) return null;
  try {
    const v = JSON.parse(reply);
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return v;
  } catch {}
  const fenceMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }
  const arrMatch = reply.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }
  const objMatch = reply.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return null;
}

export function parseMarkdownIdeas(reply) {
  if (!reply) return [];
  const ideas = [];
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
