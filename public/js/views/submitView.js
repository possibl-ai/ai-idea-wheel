import { $ } from "../utils.js";
import { CATEGORIES } from "../config.js";
import { state } from "../state.js";
import { click, isSoundOn } from "../sound.js";
import { api } from "../api.js";
import { drawPlate, drawControls } from "../dial.js";

let appHandlers = null;
let dialHandlers = null;

function checkAddBtn() {
  $("#addBtn").disabled = !$("#idea-title").value.trim();
}

export function initSubmitView(handlers, dialH) {
  appHandlers = handlers;
  dialHandlers = dialH;

  const catSel = $("#idea-cat");
  CATEGORIES.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    catSel.appendChild(o);
  });

  const titleInput = $("#idea-title");
  titleInput.addEventListener("input", checkAddBtn);
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitIdea(); }
  });

  $("#addBtn").onclick = submitIdea;
}

async function submitIdea() {
  const title = $("#idea-title").value.trim();
  if (!title) return;

  const idea = {
    title,
    description: $("#idea-desc").value.trim(),
    category: $("#idea-cat").value,
    difficulty: $("#idea-diff").value,
    estimatedHours: parseFloat($("#idea-hours").value),
    tag: $("#idea-tag").value.trim(),
  };

  $("#addBtn").disabled = true;
  if (isSoundOn()) click();

  const flashEl = $("#flash");
  try {
    const created = await api("POST", "/idea", idea);
    state.ideas.push(created);
    $("#idea-title").value = "";
    $("#idea-desc").value = "";
    $("#idea-tag").value = "";
    flashEl.textContent = "Dropped in the wheel, anonymously.";
    setTimeout(() => { flashEl.textContent = ""; }, 2600);
    appHandlers?.onDataChanged();
  } catch (e) {
    flashEl.textContent = "Error: " + e.message;
  } finally {
    checkAddBtn();
  }
}
