import { $ } from "./utils.js";

export function confettiBurst() {
  const cv = $("#confettiCanvas");
  const cx = cv.getContext("2d");
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  const colors = ["#FF5BAA", "#A655F7", "#22D3EE", "#FFD93D", "#6BCB77"];
  const particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: cv.width / 2, y: cv.height / 2,
      vx: (Math.random() - 0.5) * 16, vy: Math.random() * -16 - 4,
      g: 0.4, c: colors[i % colors.length], s: Math.random() * 6 + 3, life: 80,
    });
  }
  let frame = 0;
  function step() {
    frame++;
    cx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
      cx.fillStyle = p.c;
      cx.fillRect(p.x, p.y, p.s, p.s);
    }
    if (alive && frame < 120) requestAnimationFrame(step);
    else cx.clearRect(0, 0, cv.width, cv.height);
  }
  step();
}
