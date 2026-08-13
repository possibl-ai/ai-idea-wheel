export const state = {
  ideas: [],
  view: "dial",
  rotation: 0,
  spinning: false,
  winnerId: null,
  frozen: [],
  brainstorming: false,
  brainGenerated: [],
  brainImported: {},
  reduce:
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

export function activeIdeas() {
  return state.ideas.filter((i) => i.status === "active");
}
