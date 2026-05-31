const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const starsEl = document.getElementById("stars");
const bestEl = document.getElementById("best");
const menu = document.getElementById("menu");
const gameOver = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const W = canvas.width;
const H = canvas.height;
const horizon = 218;
const roadTop = 260;
const roadBottom = 720;
const lanes = [-0.62, 0, 0.62];

const keys = new Set();
const pointer = { active: false, x: 0 };

const state = {
  running: false,
  over: false,
  started: false,
  time: 0,
  score: 0,
  stars: 0,
  best: Number(localStorage.getItem("forestMotoBest") || 0),
  speed: 1,
  playerX: 0,
  targetX: 0,
  jump: 0,
  jumpVelocity: 0,
  invincible: 0,
  spawnTimer: 0,
  starTimer: 80,
  obstacles: [],
  collectibles: [],
  dust: [],
  leaves: [],
};

bestEl.textContent = state.best;

function resetGame() {
  state.running = true;
  state.over = false;
  state.started = true;
  state.time = 0;
  state.score = 0;
  state.stars = 0;
  state.speed = 1;
  state.playerX = 0;
  state.targetX = 0;
  state.jump = 0;
  state.jumpVelocity = 0;
  state.invincible = 0;
  state.spawnTimer = 18;
  state.starTimer = 54;
  state.obstacles = [];
  state.collectibles = [];
  state.dust = [];
  menu.classList.add("hidden");
  gameOver.classList.add("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  starsEl.textContent = state.stars;
  bestEl.textContent = state.best;
}

function roadCenter(y) {
  const t = (y - roadTop) / (roadBottom - roadTop);
  return W / 2 + Math.sin(state.time * 0.012 + t * 1.7) * 64 * t;
}

function roadHalfWidth(y) {
  const t = Math.max(0, Math.min(1, (y - roadTop) / (roadBottom - roadTop)));
  return 80 + t * t * 500;
}

function laneToScreen(lane, depth) {
  const y = roadTop + depth * (roadBottom - roadTop);
  const half = roadHalfWidth(y);
  return {
    x: roadCenter(y) + lane * half * 0.5,
    y,
    scale: 0.18 + depth * 1.25,
  };
}

function spawnObstacle() {
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  const type = Math.random() > 0.48 ? "log" : "stone";
  state.obstacles.push({ lane, depth: -0.08, type, wobble: Math.random() * 6.28 });
}

function spawnStar() {
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  state.collectibles.push({ lane, depth: -0.06, spin: Math.random() * 6.28 });
}

function endGame() {
  state.running = false;
  state.over = true;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("forestMotoBest", String(state.best));
  finalScore.textContent = `Fizeste ${Math.floor(state.score)} pontos e apanhaste ${state.stars} estrelas.`;
  gameOver.classList.remove("hidden");
  updateHud();
}

function updatePlayerInput() {
  if (keys.has("ArrowLeft") || keys.has("a")) state.targetX -= 0.045;
  if (keys.has("ArrowRight") || keys.has("d")) state.targetX += 0.045;
  if (pointer.active) {
    const normalized = (pointer.x / canvas.getBoundingClientRect().width) * 2 - 1;
    state.targetX += (normalized - state.targetX) * 0.065;
  }
  state.targetX = Math.max(-0.95, Math.min(0.95, state.targetX));
  state.playerX += (state.targetX - state.playerX) * 0.15;
}

function tryJump() {
  if (state.running && state.jump <= 0.01) {
    state.jumpVelocity = 0.34;
  }
}

function updateWorld() {
  if (!state.running) return;

  state.time += 1;
  state.speed = Math.min(2.35, state.speed + 0.00085);
  state.score += state.speed * 0.42;
  state.invincible = Math.max(0, state.invincible - 1);

  updatePlayerInput();

  state.jump += state.jumpVelocity;
  state.jumpVelocity -= 0.022;
  if (state.jump < 0) {
    state.jump = 0;
    state.jumpVelocity = 0;
  }

  state.spawnTimer -= state.speed;
  state.starTimer -= state.speed;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(34, 88 - state.speed * 16) + Math.random() * 42;
  }
  if (state.starTimer <= 0) {
    spawnStar();
    state.starTimer = 46 + Math.random() * 70;
  }

  for (const obstacle of state.obstacles) obstacle.depth += 0.0068 * state.speed * (1 + obstacle.depth * 1.35);
  for (const star of state.collectibles) {
    star.depth += 0.0074 * state.speed * (1 + star.depth * 1.28);
    star.spin += 0.14;
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.depth < 1.18);
  state.collectibles = state.collectibles.filter((star) => star.depth < 1.15 && !star.hit);

  const playerLane = state.playerX;
  for (const obstacle of state.obstacles) {
    if (obstacle.depth > 0.78 && obstacle.depth < 1.02 && Math.abs(obstacle.lane - playerLane) < 0.34) {
      if (state.jump < 0.32 && state.invincible <= 0) endGame();
    }
  }
  for (const star of state.collectibles) {
    if (star.depth > 0.78 && star.depth < 1.06 && Math.abs(star.lane - playerLane) < 0.36) {
      star.hit = true;
      state.stars += 1;
      state.score += 25;
    }
  }

  if (Math.random() < 0.7) {
    state.dust.push({
      x: W / 2 + state.playerX * 210 + (Math.random() - 0.5) * 70,
      y: 630 + Math.random() * 34,
      r: 7 + Math.random() * 13,
      life: 28,
    });
  }
  state.dust.forEach((p) => {
    p.y += 1.6;
    p.r *= 1.02;
    p.life -= 1;
  });
  state.dust = state.dust.filter((p) => p.life > 0);

  updateHud();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#9fb9ad");
  gradient.addColorStop(0.32, "#d2d2b3");
  gradient.addColorStop(0.58, "#3c5a3e");
  gradient.addColorStop(1, "#182019");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255, 233, 154, 0.72)";
  ctx.beginPath();
  ctx.arc(972, 116, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(32, 67, 43, 0.95)";
  for (let i = 0; i < 10; i += 1) {
    const x = i * 150 - 40;
    ctx.beginPath();
    ctx.moveTo(x, 260);
    ctx.lineTo(x + 90, 120 + Math.sin(i) * 22);
    ctx.lineTo(x + 185, 260);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTrees() {
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 18; i += 1) {
      const depth = ((i * 0.075 + (state.time * 0.0024 * state.speed)) % 1);
      const y = roadTop + depth * (roadBottom - roadTop);
      const half = roadHalfWidth(y);
      const center = roadCenter(y);
      const x = center + side * (half + 40 + depth * 360 + Math.sin(i * 8) * 25);
      const scale = 0.22 + depth * 1.55;
      drawTree(x, y + 18, scale, i);
    }
  }
}

function drawTree(x, y, scale, seed) {
  const trunkW = 18 * scale;
  const trunkH = 120 * scale;
  ctx.fillStyle = "#362516";
  ctx.fillRect(x - trunkW / 2, y - trunkH, trunkW, trunkH);
  ctx.fillStyle = seed % 2 ? "#174b2e" : "#1d5b34";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y - trunkH - (100 - i * 24) * scale);
    ctx.lineTo(x - (72 - i * 12) * scale, y - trunkH + (2 + i * 28) * scale);
    ctx.lineTo(x + (72 - i * 12) * scale, y - trunkH + (2 + i * 28) * scale);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 244, 182, 0.1)";
  ctx.fillRect(x - trunkW * 0.18, y - trunkH, trunkW * 0.2, trunkH);
}

function drawRoad() {
  ctx.beginPath();
  ctx.moveTo(roadCenter(roadTop) - roadHalfWidth(roadTop), roadTop);
  for (let y = roadTop; y <= roadBottom; y += 16) ctx.lineTo(roadCenter(y) - roadHalfWidth(y), y);
  ctx.lineTo(roadCenter(roadBottom) + roadHalfWidth(roadBottom), roadBottom);
  for (let y = roadBottom; y >= roadTop; y -= 16) ctx.lineTo(roadCenter(y) + roadHalfWidth(y), y);
  ctx.closePath();

  const road = ctx.createLinearGradient(0, roadTop, 0, roadBottom);
  road.addColorStop(0, "#5f604f");
  road.addColorStop(1, "#2f2a21");
  ctx.fillStyle = road;
  ctx.fill();

  ctx.strokeStyle = "rgba(246, 222, 158, 0.42)";
  ctx.lineWidth = 5;
  ctx.setLineDash([28, 28]);
  ctx.lineDashOffset = -state.time * state.speed * 4;
  for (const lane of [-0.31, 0.31]) {
    ctx.beginPath();
    for (let y = roadTop; y <= roadBottom; y += 18) {
      const x = roadCenter(y) + lane * roadHalfWidth(y);
      if (y === roadTop) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(35, 25, 17, 0.26)";
  for (let i = 0; i < 26; i += 1) {
    const depth = (i * 0.047 + state.time * 0.004 * state.speed) % 1;
    const y = roadTop + depth * (roadBottom - roadTop);
    const half = roadHalfWidth(y);
    ctx.beginPath();
    ctx.ellipse(roadCenter(y) + Math.sin(i * 11) * half * 0.6, y, 14 + depth * 34, 2 + depth * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObstacle(obstacle) {
  const pos = laneToScreen(obstacle.lane, obstacle.depth);
  if (obstacle.depth < 0) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.scale(pos.scale, pos.scale);
  if (obstacle.type === "log") {
    ctx.rotate(Math.sin(obstacle.wobble) * 0.1);
    ctx.fillStyle = "#5a371d";
    ctx.fillRect(-54, -22, 108, 38);
    ctx.fillStyle = "#8c6039";
    ctx.beginPath();
    ctx.ellipse(-54, -3, 16, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(54, -3, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(37, 21, 12, 0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-54, -3, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#595c55";
    ctx.beginPath();
    ctx.moveTo(-48, 12);
    ctx.lineTo(-28, -28);
    ctx.lineTo(20, -34);
    ctx.lineTo(54, 4);
    ctx.lineTo(25, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.beginPath();
    ctx.ellipse(-8, -15, 26, 8, -0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStar(star) {
  if (star.depth < 0) return;
  const pos = laneToScreen(star.lane, star.depth);
  ctx.save();
  ctx.translate(pos.x, pos.y - 38 * pos.scale);
  ctx.rotate(star.spin);
  ctx.scale(pos.scale, pos.scale);
  ctx.fillStyle = "#ffe27a";
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 18 : 40;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBike() {
  const baseX = W / 2 + state.playerX * 230;
  const baseY = 616 - state.jump * 190;
  const tilt = (state.targetX - state.playerX) * 0.45;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(tilt);

  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.ellipse(0, 82 + state.jump * 190, 92 - state.jump * 34, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 8;
  ctx.strokeStyle = "#171514";
  for (const wheelX of [-54, 58]) {
    ctx.beginPath();
    ctx.arc(wheelX, 38, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#434340";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(wheelX, 38, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#171514";
    ctx.lineWidth = 8;
  }

  ctx.strokeStyle = "#e2382f";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-54, 35);
  ctx.lineTo(-8, -8);
  ctx.lineTo(55, 36);
  ctx.lineTo(12, 36);
  ctx.lineTo(-54, 35);
  ctx.stroke();

  ctx.fillStyle = "#cf2b24";
  ctx.beginPath();
  ctx.roundRect(-24, -34, 70, 34, 8);
  ctx.fill();
  ctx.fillStyle = "#f2c15a";
  ctx.fillRect(24, -28, 28, 14);

  ctx.strokeStyle = "#151515";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(38, -28);
  ctx.lineTo(82, -62);
  ctx.stroke();

  ctx.fillStyle = "#2a6ac8";
  ctx.beginPath();
  ctx.ellipse(-4, -76, 24, 36, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4c69a";
  ctx.beginPath();
  ctx.arc(10, -118, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e23a2d";
  ctx.beginPath();
  ctx.arc(10, -122, 24, Math.PI, 0);
  ctx.lineTo(34, -122);
  ctx.quadraticCurveTo(20, -96, -8, -101);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDust() {
  for (const p of state.dust) {
    ctx.fillStyle = `rgba(188, 151, 96, ${p.life / 80})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  drawSky();
  drawTrees();
  drawRoad();
  drawDust();

  const sceneItems = [
    ...state.obstacles.map((item) => ({ type: "obstacle", item })),
    ...state.collectibles.map((item) => ({ type: "star", item })),
  ].sort((a, b) => a.item.depth - b.item.depth);

  for (const entry of sceneItems) {
    if (entry.type === "obstacle") drawObstacle(entry.item);
    else drawStar(entry.item);
  }

  drawBike();

  ctx.fillStyle = "rgba(12, 18, 13, 0.16)";
  ctx.fillRect(0, 0, W, H);
}

function frame() {
  updateWorld();
  render();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.code === "Space") {
    event.preventDefault();
    tryJump();
  }
  if (!state.started && (event.code === "Space" || event.key === "Enter")) resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  pointer.x = event.clientX - canvas.getBoundingClientRect().left;
  if (!state.started || state.over) resetGame();
  else tryJump();
});

canvas.addEventListener("pointermove", (event) => {
  if (pointer.active) pointer.x = event.clientX - canvas.getBoundingClientRect().left;
});

window.addEventListener("pointerup", () => {
  pointer.active = false;
});

startButton.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);

render();
requestAnimationFrame(frame);
