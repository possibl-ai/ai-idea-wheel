import { $, esc, fmtDate } from "../utils.js";
import { CAT_COLORS } from "../config.js";
import { state } from "../state.js";

export function renderFameView() {
  const b = $("#fameBody");
  const completed = state.ideas.filter((i) => i.status === "completed");

  if (completed.length === 0) {
    b.innerHTML =
      '<div class="empty">No shipped ideas yet. Spin the wheel and mark one as built to feature it here.</div>';
    return;
  }

  b.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    completed
      .map((idea) => {
        const color = idea.color || CAT_COLORS[idea.category] || "#A655F7";
        return (
          '<div class="fame-item">' +
            '<div class="top-row">' +
              '<span class="status-pill completed">Shipped</span>' +
              (idea.category ? `<span class="cat-tag" style="background:${color}">${esc(idea.category)}</span>` : "") +
              `<span class="date">${idea.completedAt ? "Built " + fmtDate(idea.completedAt) : ""}</span>` +
            "</div>" +
            `<h3 style="font-size:18px;font-weight:600">${esc(idea.title)}</h3>` +
            (idea.description ? `<p style="font-size:13px;color:var(--ink-2)">${esc(idea.description)}</p>` : "") +
          "</div>"
        );
      })
      .join("") +
    "</div>";
}
