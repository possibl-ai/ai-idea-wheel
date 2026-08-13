import { $, esc, trunc } from "./utils.js";
import { SEG } from "./config.js";
import { state, activeIdeas } from "./state.js";

function ptTopCW(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function slice(cx, cy, r, s, e) {
  const [sx, sy] = ptTopCW(cx, cy, r, s);
  const [ex, ey] = ptTopCW(cx, cy, r, e);
  const big = e - s > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${big} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`;
}

export function drawPlate() {
  const list = state.spinning ? state.frozen : activeIdeas();
  const plate = $("#plate");
  plate.style.transition = "none";
  plate.style.transform = `rotate(${state.rotation}deg)`;
  const n = list.length;

  if (n === 0) {
    plate.innerHTML =
      '<circle cx="200" cy="200" r="170" fill="#f3eef7" stroke="rgba(20,16,30,.06)" stroke-width="1.5"/>';
    return;
  }

  if (n === 1) {
    plate.innerHTML =
      `<circle cx="200" cy="200" r="170" fill="${SEG[0]}"/>` +
      `<text x="200" y="92" text-anchor="middle" class="seg-label">${esc(trunc(list[0].title, 20))}</text>`;
    return;
  }

  const seg = 360 / n;
  let out = "";
  list.forEach((idea, i) => {
    const s = i * seg;
    const e = (i + 1) * seg;
    const mid = s + seg / 2;
    const [lx, ly] = ptTopCW(200, 200, 112, mid);
    const fs = Math.max(8, 13 - Math.max(0, n - 8) * 0.4);
    const color = idea.color || SEG[i % SEG.length];
    out +=
      `<path d="${slice(200, 200, 170, s, e)}" fill="${color}" stroke="#FAF8F4" stroke-width="2"/>` +
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="seg-label" style="font-size:${fs}px">${esc(trunc(idea.title, n > 12 ? 10 : 15))}</text>`;
  });
  plate.innerHTML = out;
}

export function drawControls(handlers) {
  const c = $("#controls");
  const w = state.winnerId ? state.ideas.find((i) => i.id === state.winnerId) : null;
  $("#lamp").classList.toggle("lit", !!w);

  if (w) {
    const dateStr = w.completedAt ? new Date(w.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    c.innerHTML =
      '<div class="locked">' +
        '<span class="eyebrow kk">Locked in</span>' +
        `<h2>${esc(w.title)}</h2>` +
        '<div class="meta-row">' +
          (w.category ? `<span class="cat-tag" style="background:${w.color || SEG[0]}">${esc(w.category)}</span>` : "") +
          `<span class="status-pill active">${esc(w.difficulty || "")} &middot; ${w.estimatedHours || 0.75}h</span>` +
        "</div>" +
        (w.description ? `<p class="note">${esc(w.description)}</p>` : "") +
        (dateStr ? `<p class="note" style="font-family:JetBrains Mono,monospace;font-size:11px">Completed ${esc(dateStr)}</p>` : "") +
        '<div class="row">' +
          '<button class="btn btn-dark" id="buildBtn">Mark as built</button>' +
          '<button class="btn btn-ghost" id="againBtn">Spin again</button>' +
        "</div>" +
      "</div>";
    $("#buildBtn").onclick = () => handlers.onMarkBuilt(w.id);
    $("#againBtn").onclick = () => { state.winnerId = null; drawControls(handlers); };
  } else {
    const n = activeIdeas().length;
    c.innerHTML =
      `<button class="btn btn-grad" id="spinBtn"${n < 2 ? " disabled" : ""}>Spin the wheel</button>` +
      `<p class="hint">${n < 2 ? `Need at least 2 ideas in the pool. ${n} so far.` : `${n} ideas loaded. Give it a spin.`}</p>`;
    if (n >= 2) $("#spinBtn").onclick = handlers.onSpin;
  }
}

export function spin(handlers) {
  const list = activeIdeas();
  if (state.spinning || list.length < 2) return;
  state.winnerId = null;
  state.frozen = list.slice();
  state.spinning = true;

  const idx = Math.floor(Math.random() * list.length);
  const seg = 360 / list.length;
  const targetCenter = idx * seg + seg / 2;
  const curMod = ((state.rotation % 360) + 360) % 360;
  const desired = (((360 - targetCenter) % 360) + 360) % 360;
  let delta = ((desired - curMod) % 360 + 360) % 360;
  delta += 360 * (state.reduce ? 0 : 5 + Math.floor(Math.random() * 3));
  if (delta === 0) delta = 360;
  const dur = state.reduce ? 320 : 4600;

  drawControls(handlers);
  const plate = $("#plate");
  plate.style.transition = `transform ${dur}ms cubic-bezier(.12,.72,.09,1)`;
  state.rotation += delta;
  plate.style.transform = `rotate(${state.rotation}deg)`;

  handlers.onSpinStart();

  setTimeout(() => {
    state.spinning = false;
    const chosen = state.frozen[idx];
    state.winnerId = chosen.id;
    drawPlate();
    drawControls(handlers);
    handlers.onSpinComplete(chosen);
  }, dur + 70);
}
