import { $ } from "../utils.js";
import { state } from "../state.js";
import { click, ding, fanfare, thud, isSoundOn } from "../sound.js";
import { confettiBurst } from "../confetti.js";
import { drawPlate, drawControls, spin } from "../dial.js";
import { api } from "../api.js";

let appHandlers = null;

function playSpinTicks() {
  if (!isSoundOn() || state.reduce) return;
  let tickCount = 0;
  const totalTicks = 40;
  const tickLoop = () => {
    if (tickCount >= totalTicks) return;
    if (tickCount < totalTicks - 8) click();
    else thud();
    const delay = tickCount < totalTicks - 8
      ? 40 + (tickCount > 8 ? tickCount * 2 : 0)
      : 200 + (tickCount - (totalTicks - 8)) * 80;
    tickCount++;
    setTimeout(tickLoop, delay);
  };
  tickLoop();
}

const dialHandlers = {
  onSpin() {
    spin(dialHandlers);
  },
  onSpinStart() {
    playSpinTicks();
  },
  async onSpinComplete(chosen) {
    if (isSoundOn()) fanfare();
    if (!state.reduce) confettiBurst();
    try {
      await api("POST", "/spin", { id: chosen.id, title: chosen.title, totalEligible: state.frozen.length });
    } catch (e) {
      console.error("spin record failed:", e);
    }
  },
  async onMarkBuilt(id) {
    try {
      const updated = await api("POST", "/complete", { id });
      const idx = state.ideas.findIndex((i) => i.id === id);
      if (idx >= 0) state.ideas[idx] = updated;
      state.winnerId = null;
      if (isSoundOn()) ding();
      drawPlate();
      drawControls(dialHandlers);
      appHandlers?.onDataChanged();
    } catch (e) {
      console.error("complete failed:", e);
      alert("Failed to mark as built: " + e.message);
    }
  },
};

export function initDialView(handlers) {
  appHandlers = handlers;
  drawPlate();
  drawControls(dialHandlers);
}

export function refreshDialView() {
  if (!state.spinning) drawPlate();
  drawControls(dialHandlers);
}
