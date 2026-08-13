export const PORT = process.env.PORT || "8080";

export const RCRT_BASE_URL =
  process.env.RCRT_API_URL ||
  "http://api-gateway.rcrt-platform.svc.cluster.local:8080";

export const RCRT_SERVICE_KEY = process.env.RCRT_SERVICE_KEY || "";
export const RCRT_TENANT_ID = process.env.RCRT_TENANT_ID || "";
export const RCRT_USER_ID = process.env.RCRT_USER_ID || "";

export const TAGS = {
  IDEA: "ai-idea-wheel:idea",
  SPIN: "ai-idea-wheel:spin",
  COMPLETION: "ai-idea-wheel:completion",
};

export const CATEGORY_COLORS = {
  "LLM & Agents": "#6366f1",
  "Computer Vision": "#10b981",
  "Audio & Multimodal": "#ec4899",
  "Automation & RAG": "#f59e0b",
  "Creative AI & Gaming": "#8b5cf6",
  "Fun & Experimental": "#06b6d4",
};

export const CATEGORIES = Object.keys(CATEGORY_COLORS);
