import { $, esc, fmtDate } from "../utils.js";
import { CAT_COLORS } from "../config.js";
import { state, activeIdeas } from "../state.js";
import { ding, isSoundOn } from "../sound.js";
import { api } from "../api.js";

let appHandlers = null;

export function initPoolView(handlers) {
  appHandlers = handlers;
}

export function renderPoolView() {
  const b = $("#poolBody");
  const activeCount = activeIdeas().length;
  const completedCount = state.ideas.filter((i) => i.status === "completed").length;
  $("#poolCounts").textContent = `${activeCount} active / ${completedCount} built / ${state.ideas.length} total`;

  if (state.ideas.length === 0) {
    b.innerHTML =
      '<div class="empty">The wheel is empty. Head to <a id="goSubmit">Submit</a> or <a id="goBrain">Brainstorm</a> to add the first idea.</div>';
    const gs = $("#goSubmit");
    if (gs) gs.onclick = () => appHandlers?.switchView("submit");
    const gb = $("#goBrain");
    if (gb) gb.onclick = () => appHandlers?.switchView("brainstorm");
    return;
  }

  let rows = "";
  state.ideas.forEach((idea, i) => {
    const built = idea.status === "completed";
    const color = idea.color || CAT_COLORS[idea.category] || "#A655F7";
    rows +=
      `<li class="spec${built ? " completed" : ""}>` +
        `<span class="idx">${String(i + 1).padStart(2, "0")}</span>` +
        `<div class="body"><div class="t">${esc(idea.title)}</div>` +
        (idea.description ? `<div class="n">${esc(idea.description)}</div>` : "") + "</div>" +
        '<div class="meta">' +
          (idea.category ? `<span class="cat-tag" style="background:${color}">${esc(idea.category)}</span>` : "") +
          `<span class="status-pill ${built ? "completed" : "active"}">${built ? "Built" : "Available"}</span>` +
          `<span class="date">${built && idea.completedAt ? "Built " + fmtDate(idea.completedAt) : "Added " + fmtDate(idea.createdAt)}</span>` +
        "</div>" +
        '<div class="actions">' +
          (built
            ? `<button class="mini" data-act="restore" data-id="${idea.id}">restore</button>`
            : `<button class="mini" data-act="complete" data-id="${idea.id}">mark built</button>`) +
          `<button class="mini danger" data-act="remove" data-id="${idea.id}">remove</button>` +
        "</div>" +
      "</li>";
  });

  b.innerHTML =
    `<ul class="specimens">${rows}</ul>` +
    '<div class="pool-foot"><button class="btn btn-ghost btn-danger" id="clearBtn">Clear all</button></div>';

  b.querySelectorAll(".mini").forEach((btn) => {
    btn.onclick = () => poolAction(btn.dataset.act, btn.dataset.id);
  });
  $("#clearBtn").onclick = confirmClear;
}

async function poolAction(act, id) {
  if (act === "remove") {
    state.ideas = state.ideas.filter((i) => i.id !== id);
    if (state.winnerId === id) state.winnerId = null;
    renderPoolView();
    appHandlers?.onDataChanged();
    try { await api("DELETE", "/idea/" + id); } catch { appHandlers?.setConn(false); }
  } else if (act === "complete") {
    try {
      const updated = await api("POST", "/complete", { id });
      const idx = state.ideas.findIndex((i) => i.id === id);
      if (idx >= 0) state.ideas[idx] = updated;
      renderPoolView();
      appHandlers?.onDataChanged();
      if (isSoundOn()) ding();
    } catch (e) { alert("Failed: " + e.message); }
  } else if (act === "restore") {
    try {
      const updated = await api("POST", "/restore", { id });
      const idx = state.ideas.findIndex((i) => i.id === id);
      if (idx >= 0) state.ideas[idx] = updated;
      renderPoolView();
      appHandlers?.onDataChanged();
    } catch (e) { alert("Failed: " + e.message); }
  }
}

function confirmClear() {
  const foot = $(".pool-foot");
  foot.innerHTML =
    '<span class="hint">Remove every idea for everyone?</span>' +
    '<button class="btn btn-dark" id="yesClear">Yes, clear it</button>' +
    '<button class="btn btn-ghost" id="noClear">Cancel</button>';
  $("#noClear").onclick = renderPoolView;
  $("#yesClear").onclick = async () => {
    state.ideas = [];
    state.winnerId = null;
    renderPoolView();
    appHandlers?.onDataChanged();
    try { await api("DELETE", "/ideas"); } catch { appHandlers?.setConn(false); }
  };
}
