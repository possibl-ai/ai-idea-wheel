import { $, esc } from "../utils.js";
import { CAT_COLORS, PRESET_TOPICS } from "../config.js";
import { state } from "../state.js";
import { click, isSoundOn } from "../sound.js";
import { api } from "../api.js";

let appHandlers = null;

export function initBrainstormView(handlers) {
  appHandlers = handlers;

  const presetRow = $("#presetRow");
  PRESET_TOPICS.forEach((t) => {
    const b = document.createElement("button");
    b.className = "preset";
    b.type = "button";
    b.textContent = t;
    b.onclick = () => { $("#brain-topic").value = t; doBrainstorm(t); };
    presetRow.appendChild(b);
  });

  $("#brain-topic").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doBrainstorm(); }
  });
  $("#brainBtn").onclick = () => doBrainstorm();
}

async function doBrainstorm(topic) {
  if (state.brainstorming) return;
  const t = (topic || $("#brain-topic").value || "").trim();
  state.brainstorming = true;
  $("#brainBtn").disabled = true;
  $("#brain-status").textContent = "Brainstorming via RCRT agent...";
  $("#aiResults").innerHTML = "";

  try {
    const data = await api("POST", "/brainstorm", { topic: t });
    state.brainGenerated = data.ideas || [];
    state.brainImported = {};
    $("#brain-status").textContent =
      state.brainGenerated.length + " ideas generated. Add the ones you like to the wheel.";
    renderBrainResults();
  } catch (e) {
    $("#brain-status").textContent = "Error: " + e.message;
  } finally {
    state.brainstorming = false;
    $("#brainBtn").disabled = false;
  }
}

function renderBrainResults() {
  const el = $("#aiResults");
  if (state.brainGenerated.length === 0) { el.innerHTML = ""; return; }

  el.innerHTML = state.brainGenerated.map((item, i) => {
    const color = CAT_COLORS[item.category] || "#A655F7";
    return (
      '<div class="ai-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
          `<span class="cat" style="background:${color}">${esc(item.category || "AI")}</span>` +
          `<span class="diff">${esc(item.difficulty || "")} &middot; ${item.estimatedHours || 0.75}h</span>` +
        "</div>" +
        `<div><h4>${esc(item.title)}</h4><p>${esc(item.description || "")}</p></div>` +
        `<button class="add-btn${state.brainImported[i] ? " added" : ""}" data-idx="${i}">${state.brainImported[i] ? "\u2713 Added to wheel" : "Add to wheel"}</button>` +
      "</div>"
    );
  }).join("");

  el.querySelectorAll(".add-btn").forEach((btn) => {
    btn.onclick = () => importBrainIdea(parseInt(btn.dataset.idx));
  });
}

async function importBrainIdea(idx) {
  const item = state.brainGenerated[idx];
  if (!item || state.brainImported[idx]) return;

  try {
    const created = await api("POST", "/idea", {
      title: item.title,
      description: item.description,
      category: item.category || "LLM & Agents",
      difficulty: item.difficulty || "Beginner",
      estimatedHours: Math.min(item.estimatedHours || 0.75, 1),
      tag: (item.tags && item.tags[0]) || "AIBrainstorm",
    });
    state.ideas.push(created);
    state.brainImported[idx] = true;
    if (isSoundOn()) click();
    appHandlers?.onDataChanged();
    renderBrainResults();
  } catch (e) {
    alert("Failed to add: " + e.message);
  }
}
