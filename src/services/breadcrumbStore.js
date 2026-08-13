import { client } from "./rcrtClient.js";
import { TAGS, CATEGORY_COLORS, RCRT_USER_ID } from "../config.js";
import { crumbToIdea } from "../lib/ideaMapper.js";

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listIdeas() {
  const crumbs = await client.breadcrumbs.query({ tags: TAGS.IDEA, limit: 1000 });
  return crumbs
    .filter((c) => !c.deleted_at)
    .map(crumbToIdea)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createIdea(body) {
  const title = (body.title || body.text || "").trim();
  if (!title) throw new Error("title is required");
  if (title.length > 200) throw new Error("title too long (max 200)");

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
    name: genId("ai-idea"),
    title,
    content: ideaContent,
    tags: [TAGS.IDEA],
    upsert: false,
  });

  return crumbToIdea(crumb);
}

export async function deleteIdea(id) {
  await client.breadcrumbs.delete(id);
}

export async function clearAllIdeas() {
  const crumbs = await client.breadcrumbs.query({ tags: TAGS.IDEA, limit: 1000 });
  for (const c of crumbs) {
    if (!c.deleted_at) {
      try { await client.breadcrumbs.delete(c.id); } catch {}
    }
  }
}

export async function completeIdea(id) {
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

  try {
    await client.breadcrumbs.create({
      name: genId(`completion-${id}`),
      title: content.title || "Completed idea",
      content: {
        type: "completion",
        ideaId: id,
        ideaTitle: content.title,
        completedAt: now,
        performedBy: RCRT_USER_ID || "anonymous",
      },
      tags: [TAGS.COMPLETION],
      parent_ids: [id],
      upsert: false,
    });
  } catch (e) {
    console.error("completion breadcrumb failed:", e);
  }

  return crumbToIdea(updated);
}

export async function restoreIdea(id) {
  const crumb = await client.breadcrumbs.get(id);
  const content = crumb.content || {};
  content.status = "active";
  content.completedAt = null;

  const updated = await client.breadcrumbs.update(id, {
    version: crumb.version,
    content,
    tags: crumb.tags,
  });

  return crumbToIdea(updated);
}

export async function recordSpin(body) {
  const now = new Date().toISOString();
  await client.breadcrumbs.create({
    name: genId("spin"),
    title: body.title || "Spin event",
    content: {
      type: "spin",
      selectedIdeaId: body.id,
      selectedIdeaTitle: body.title,
      totalEligible: body.totalEligible || 0,
      timestamp: now,
      performedBy: RCRT_USER_ID || "anonymous",
    },
    tags: [TAGS.SPIN],
    upsert: false,
  });
}
