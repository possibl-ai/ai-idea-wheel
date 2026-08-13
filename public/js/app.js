import { $ } from "./utils.js";
import { state, activeIdeas } from "./state.js";
import { setSoundOn, isSoundOn, click } from "./sound.js";
import { api } from "./api.js";
import { initDialView, refreshDialView } from "./views/dialView.js";
import { initSubmitView } from "./views/submitView.js";
import { initBrainstormView } from "./views/brainstormView.js";
import { initPoolView, renderPoolView } from "./views/poolView.js";
import { renderFameView } from "./views/fameView.js";

function setConn(ok) {
  const c = $("#conn");
  c.classList.toggle("bad", !ok);
  $("#connText").textContent = ok ? "Connected" : "Offline";
}

function syncTabCount() {
  const t = document.querySelector('.tab[data-view="pool"]');
  const n = activeIdeas().length;
  t.textContent = n > 0 ? "Pool \u00b7 " + n : "Pool";
}

function switchView(v) {
  state.view = v;
  document.querySelectorAll(".tab").forEach((t) =>
    t.setAttribute("aria-selected", t.dataset.view === v ? "true" : "false")
  );
  document.querySelectorAll(".view").forEach((s) => s.classList.remove("on"));
  $("#view-" + v).classList.add("on");
  if (v === "dial") refreshDialView();
  if (v === "pool") renderPoolView();
  if (v === "fame") renderFameView();
}

const appHandlers = {
  switchView,
  onDataChanged() {
    syncTabCount();
    if (state.view === "dial") refreshDialView();
    if (state.view === "pool") renderPoolView();
    if (state.view === "fame") renderFameView();
  },
  setConn,
};

async function load() {
  try {
    state.ideas = (await api("GET", "/ideas")).ideas || [];
    setConn(true);
  } catch {
    setConn(false);
  }
  if (state.view === "dial" && !state.spinning) refreshDialView();
  if (state.view === "pool") renderPoolView();
  if (state.view === "fame") renderFameView();
  syncTabCount();
}

// ── init ──
initDialView(appHandlers);
initSubmitView(appHandlers);
initBrainstormView(appHandlers);
initPoolView(appHandlers);

document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => switchView(t.dataset.view);
});

$("#audioToggle").onclick = () => {
  const on = !isSoundOn();
  setSoundOn(on);
  $("#audioIcon").innerHTML = on ? "&#128266;" : "&#128263;";
  $("#audioLabel").textContent = on ? "Sound on" : "Muted";
  if (on) click();
};

load();
setInterval(() => {
  if (!state.spinning && (state.view === "dial" || state.view === "pool")) load();
}, 10000);
