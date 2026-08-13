export const $ = (s) => document.querySelector(s);

export function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c])
  );
}

export function trunc(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + "\u2026" : (s || "");
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
