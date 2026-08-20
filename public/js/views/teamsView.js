import { $, esc } from "../utils.js";

let appHandlers = null;

const TEAM_COLORS = [
  "#FF5BAA", "#A655F7", "#22D3EE", "#6366f1", "#10b981",
  "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444",
];

/**
 * Split names into teams of a target size, never producing a team of 1.
 *
 * If the remainder is 1, we borrow one member from a full team so the last
 * two teams both have at least 2 members. This may make one team larger
 * than the target size, which is the intended trade-off.
 */
function buildTeams(names, targetSize) {
  const shuffled = [...names];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const teams = [];
  for (let i = 0; i < shuffled.length; i += targetSize) {
    teams.push(shuffled.slice(i, i + targetSize));
  }

  // If the last team is a solo, merge it into the previous team.
  if (teams.length >= 2 && teams[teams.length - 1].length === 1) {
    const solo = teams.pop();
    teams[teams.length - 1] = teams[teams.length - 1].concat(solo);
  }

  return teams;
}

function minTeamSize(names) {
  if (names.length < 4) return names.length;
  return Math.min(Math.floor(names.length / 2), 8);
}

function maxTeamSize(names) {
  return Math.max(2, names.length - 1);
}

function renderTeamSizeOptions(names) {
  const sel = $("#team-size");
  const current = parseInt(sel.value, 10) || 2;
  sel.innerHTML = "";
  const min = minTeamSize(names);
  const max = maxTeamSize(names);
  for (let s = min; s <= max; s++) {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s + " per team";
    sel.appendChild(o);
  }
  sel.value = Math.min(current, max) >= min ? Math.min(current, max) : min;
}

function parseNames() {
  const raw = $("#team-names").value;
  return raw
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

function checkGenerateBtn() {
  const names = parseNames();
  const size = parseInt($("#team-size").value, 10) || 2;
  $("#generateTeamsBtn").disabled = names.length < 2 || names.length < size;
  renderTeamSizeOptions(names);
}

export function initTeamsView(handlers) {
  appHandlers = handlers;

  const ta = $("#team-names");
  ta.addEventListener("input", checkGenerateBtn);

  $("#team-size").addEventListener("change", checkGenerateBtn);

  $("#generateTeamsBtn").onclick = generateTeams;
  $("#reshuffleBtn").onclick = generateTeams;
}

function generateTeams() {
  const names = parseNames();
  if (names.length < 2) return;

  const size = parseInt($("#team-size").value, 10) || 2;
  if (names.length < size) return;

  const teams = buildTeams(names, size);
  renderTeams(teams);
}

function renderTeams(teams) {
  const out = $("#teamsOutput");
  if (!teams || teams.length === 0) {
    out.innerHTML = "";
    $("#reshuffleBtn").style.display = "none";
    return;
  }

  let html = "";
  teams.forEach((team, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    const members = team
      .map((m) => `<li>${esc(m)}</li>`)
      .join("");
    html +=
      `<div class="team-card" style="--team-color:${color}">` +
        `<div class="team-head">` +
          `<span class="team-badge">Team ${i + 1}</span>` +
          `<span class="team-count">${team.length} ${team.length === 1 ? "member" : "members"}</span>` +
        `</div>` +
        `<ul class="team-members">${members}</ul>` +
      `</div>`;
  });

  out.innerHTML = html;
  $("#reshuffleBtn").style.display = "inline-flex";
}
