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
const trailTop = 245;
const trailBottom = 720;
const lanes = [-0.58, 0, 0.58];
const backgroundImage = new Image();
backgroundImage.src = "assets/forest-trail-realistic.png";

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
  flecks: [],
};

bestEl.textContent = state.best;

function hasPhotoBackground() {
  return backgroundImage.complete && backgroundImage.naturalWidth > 0;
}

const treeRows = Array.from({ length: 54 }, (_, i) => ({
  seed: i * 19.37,
  side: i % 2 ? 1 : -1,
  offset: 0.04 + ((i * 0.137) % 1),
  lean: Math.sin(i * 2.1) * 0.18,
  bulk: 0.7 + ((i * 0.41) % 1) * 0.75,
}));

const groundMarks = Array.from({ length: 84 }, (_, i) => ({
  seed: i * 12.91,
  x: Math.sin(i * 5.2),
  d: (i * 0.031) % 1,
  kind: i % 4,
}));

const canopyLeaves = Array.from({ length: 160 }, (_, i) => ({
  x: (Math.sin(i * 78.23) * 0.5 + 0.5) * W,
  y: (Math.sin(i * 31.71) * 0.5 + 0.5) * 210,
  r: 18 + ((i * 13) % 38),
  tone: i % 5,
}));

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
  state.spawnTimer = 26;
  state.starTimer = 64;
  state.obstacles = [];
  state.collectibles = [];
  state.dust = [];
  state.flecks = [];
  menu.classList.add("hidden");
  gameOver.classList.add("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  starsEl.textContent = state.stars;
  bestEl.textContent = state.best;
}

function curveAt(depth) {
  return Math.sin(state.time * 0.009 + depth * 2.1) * 86 * depth + Math.sin(state.time * 0.004 + depth * 5.8) * 22 * depth;
}

function trailY(depth) {
  const eased = Math.pow(Math.max(0, depth), 1.36);
  return trailTop + eased * (trailBottom - trailTop);
}

function trailCenter(y) {
  const depth = Math.max(0, Math.min(1, (y - trailTop) / (trailBottom - trailTop)));
  return W / 2 + curveAt(depth);
}

function trailHalfWidth(y) {
  const depth = Math.max(0, Math.min(1, (y - trailTop) / (trailBottom - trailTop)));
  const base = 32 + Math.pow(depth, 1.85) * 385;
  const ragged = Math.sin(depth * 28 + state.time * 0.02) * 10 * depth;
  return base + ragged;
}

function laneToScreen(lane, depth) {
  const y = trailY(depth);
  const half = trailHalfWidth(y);
  return {
    x: trailCenter(y) + lane * half * 0.7,
    y,
    scale: 0.12 + depth * 1.28,
  };
}

function spawnObstacle() {
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  const roll = Math.random();
  const type = roll > 0.66 ? "stump" : roll > 0.34 ? "branch" : "stone";
  state.obstacles.push({ lane, depth: -0.08, type, wobble: Math.random() * Math.PI * 2 });
}

function spawnStar() {
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  state.collectibles.push({ lane, depth: -0.06, spin: Math.random() * Math.PI * 2 });
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
  if (keys.has("ArrowLeft") || keys.has("a")) state.targetX -= 0.042;
  if (keys.has("ArrowRight") || keys.has("d")) state.targetX += 0.042;
  if (pointer.active) {
    const normalized = (pointer.x / canvas.getBoundingClientRect().width) * 2 - 1;
    state.targetX += (normalized - state.targetX) * 0.06;
  }
  state.targetX = Math.max(-0.94, Math.min(0.94, state.targetX));
  state.playerX += (state.targetX - state.playerX) * 0.14;
}

function tryJump() {
  if (state.running && state.jump <= 0.01) state.jumpVelocity = 0.34;
}

function updateWorld() {
  if (!state.running) return;

  state.time += 1;
  state.speed = Math.min(2.45, state.speed + 0.0009);
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
    state.spawnTimer = Math.max(33, 86 - state.speed * 15) + Math.random() * 38;
  }
  if (state.starTimer <= 0) {
    spawnStar();
    state.starTimer = 52 + Math.random() * 72;
  }

  for (const obstacle of state.obstacles) obstacle.depth += 0.0065 * state.speed * (1 + obstacle.depth * 1.36);
  for (const star of state.collectibles) {
    star.depth += 0.0072 * state.speed * (1 + star.depth * 1.28);
    star.spin += 0.13;
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.depth < 1.17);
  state.collectibles = state.collectibles.filter((star) => star.depth < 1.15 && !star.hit);

  for (const obstacle of state.obstacles) {
    if (obstacle.depth > 0.78 && obstacle.depth < 1.03 && Math.abs(obstacle.lane - state.playerX) < 0.34) {
      if (state.jump < 0.32 && state.invincible <= 0) endGame();
    }
  }
  for (const star of state.collectibles) {
    if (star.depth > 0.78 && star.depth < 1.06 && Math.abs(star.lane - state.playerX) < 0.36) {
      star.hit = true;
      state.stars += 1;
      state.score += 25;
    }
  }

  if (Math.random() < 0.75) {
    const y = 634 + Math.random() * 42;
    state.dust.push({
      x: trailCenter(y) + state.playerX * 218 + (Math.random() - 0.5) * 76,
      y,
      r: 7 + Math.random() * 15,
      life: 30,
      tone: Math.random(),
    });
  }

  if (Math.random() < 0.35) {
    state.flecks.push({
      x: Math.random() * W,
      y: -18,
      vx: -0.4 + Math.random() * 0.8,
      vy: 1.2 + Math.random() * 2.3,
      life: 140,
      r: 2 + Math.random() * 4,
    });
  }

  for (const p of state.dust) {
    p.y += 1.4;
    p.r *= 1.025;
    p.life -= 1;
  }
  for (const fleck of state.flecks) {
    fleck.x += fleck.vx + Math.sin((state.time + fleck.y) * 0.03) * 0.55;
    fleck.y += fleck.vy;
    fleck.life -= 1;
  }
  state.dust = state.dust.filter((p) => p.life > 0);
  state.flecks = state.flecks.filter((p) => p.life > 0 && p.y < H + 30);

  updateHud();
}

function drawBackground() {
  if (hasPhotoBackground()) {
    const drift = Math.sin(state.time * 0.004) * 10;
    const zoom = 1.045;
    const drawW = W * zoom;
    const drawH = H * zoom;
    ctx.drawImage(backgroundImage, (W - drawW) / 2 + drift, (H - drawH) / 2, drawW, drawH);

    const focus = ctx.createRadialGradient(W / 2, H * 0.62, 110, W / 2, H * 0.62, 680);
    focus.addColorStop(0, "rgba(0, 0, 0, 0)");
    focus.addColorStop(0.72, "rgba(0, 0, 0, 0.06)");
    focus.addColorStop(1, "rgba(0, 0, 0, 0.36)");
    ctx.fillStyle = focus;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#b8c6b2");
  sky.addColorStop(0.28, "#8ca080");
  sky.addColorStop(0.55, "#3a5138");
  sky.addColorStop(1, "#172014");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(860, 120, 8, 860, 120, 410);
  glow.addColorStop(0, "rgba(255, 231, 168, 0.75)");
  glow.addColorStop(0.2, "rgba(236, 213, 143, 0.32)");
  glow.addColorStop(1, "rgba(236, 213, 143, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawDistantWoods();
  drawCanopy();
}

function drawDistantWoods() {
  for (let layer = 0; layer < 4; layer += 1) {
    const trunkColor = [`rgba(39, 57, 39, 0.46)`, "rgba(31, 49, 34, 0.56)", "rgba(23, 39, 28, 0.7)", "rgba(17, 31, 23, 0.82)"][layer];
    const leafColor = [`rgba(50, 82, 52, 0.48)`, "rgba(42, 72, 45, 0.6)", "rgba(31, 58, 39, 0.72)", "rgba(22, 45, 32, 0.86)"][layer];
    const baseY = 255 + layer * 36;
    const gap = 58 - layer * 6;

    ctx.fillStyle = trunkColor;
    for (let x = -60; x <= W + 80; x += gap) {
      const noise = Math.sin(x * 0.027 + layer * 4);
      const trunkW = 8 + layer * 4 + Math.abs(noise) * 5;
      const topY = 88 + layer * 26 + noise * 34;
      ctx.fillRect(x + noise * 14, topY, trunkW, H - topY);
      ctx.fillRect(x + 19 - noise * 10, topY + 32, Math.max(4, trunkW * 0.45), H - topY);
    }

    ctx.fillStyle = leafColor;
    for (let x = -90; x <= W + 110; x += 46) {
      const y = baseY - 115 + Math.sin(x * 0.018 + layer) * 38;
      const r = 64 + layer * 18 + Math.sin(x * 0.04) * 14;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.7, Math.sin(x) * 0.35, 0, Math.PI * 2);
      ctx.ellipse(x + 34, y + 18, r * 1.05, r * 0.58, Math.cos(x) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCanopy() {
  for (const leaf of canopyLeaves) {
    const sway = Math.sin(state.time * 0.01 + leaf.x * 0.02) * 8;
    const colors = ["#173a24", "#1d4a2b", "#244f2e", "#2f5d35", "#0f2c1d"];
    ctx.fillStyle = colors[leaf.tone];
    ctx.beginPath();
    ctx.ellipse(leaf.x + sway, leaf.y, leaf.r * 1.35, leaf.r * 0.62, Math.sin(leaf.x) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const shade = ctx.createLinearGradient(0, 0, 0, 220);
  shade.addColorStop(0, "rgba(3, 13, 8, 0.7)");
  shade.addColorStop(1, "rgba(3, 13, 8, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, 230);
}

function drawForestFloor() {
  if (hasPhotoBackground()) {
    for (let i = 0; i < 54; i += 1) {
      const depth = (i * 0.037 + state.time * 0.003 * state.speed) % 1;
      const y = trailY(depth);
      const half = trailHalfWidth(y);
      const side = i % 2 ? -1 : 1;
      const x = trailCenter(y) + side * (half + 18 + Math.sin(i * 2.9) * 90 * depth);
      const s = 0.16 + depth * 1.6;
      ctx.fillStyle = i % 2 ? "rgba(39, 68, 32, 0.28)" : "rgba(117, 83, 38, 0.24)";
      ctx.beginPath();
      ctx.ellipse(x, y + 8 * s, 20 * s, 7 * s, Math.sin(i) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const floor = ctx.createLinearGradient(0, trailTop - 20, 0, H);
  floor.addColorStop(0, "#30422b");
  floor.addColorStop(0.55, "#243221");
  floor.addColorStop(1, "#171e13");
  ctx.fillStyle = floor;
  ctx.fillRect(0, trailTop - 28, W, H - trailTop + 28);

  for (let i = 0; i < 60; i += 1) {
    const depth = (i * 0.023 + state.time * 0.002 * state.speed) % 1;
    const y = trailY(depth);
    const half = trailHalfWidth(y);
    const center = trailCenter(y);
    const side = i % 2 ? -1 : 1;
    const x = center + side * (half + 16 + depth * 360 + Math.sin(i * 4.7) * 90);
    const s = 0.25 + depth * 1.5;
    ctx.fillStyle = i % 3 ? "rgba(54, 66, 35, 0.55)" : "rgba(83, 67, 35, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 22 * s, 7 * s, Math.sin(i) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 44; i += 1) {
    const depth = (i * 0.041 + state.time * 0.0028 * state.speed) % 1;
    const y = trailY(depth);
    const half = trailHalfWidth(y);
    const side = i % 2 ? -1 : 1;
    const x = trailCenter(y) + side * (half + 6 + Math.sin(i * 3.1) * 62 * depth);
    const s = 0.2 + depth * 1.4;
    ctx.strokeStyle = i % 2 ? "rgba(24, 43, 22, 0.62)" : "rgba(75, 61, 35, 0.5)";
    ctx.lineWidth = 2 + s * 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 8 * s);
    ctx.quadraticCurveTo(x + side * 20 * s, y - 14 * s, x + side * 42 * s, y + 4 * s);
    ctx.stroke();
  }
}

function drawTrail() {
  const left = [];
  const right = [];
  for (let y = trailTop; y <= trailBottom + 12; y += 12) {
    const depth = (y - trailTop) / (trailBottom - trailTop);
    const center = trailCenter(y);
    const half = trailHalfWidth(y);
    const edgeWave = Math.sin(depth * 34 + state.time * 0.025) * 12 * depth;
    left.push([center - half + edgeWave, y]);
    right.push([center + half + Math.cos(depth * 29 + state.time * 0.021) * 13 * depth, y]);
  }

  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();

  const dirt = ctx.createLinearGradient(0, trailTop, 0, H);
  if (hasPhotoBackground()) {
    dirt.addColorStop(0, "rgba(92, 80, 61, 0.18)");
    dirt.addColorStop(0.35, "rgba(106, 86, 59, 0.26)");
    dirt.addColorStop(1, "rgba(53, 37, 25, 0.38)");
  } else {
    dirt.addColorStop(0, "#5c503d");
    dirt.addColorStop(0.35, "#6a563b");
    dirt.addColorStop(1, "#352519");
  }
  ctx.fillStyle = dirt;
  ctx.fill();

  ctx.save();
  ctx.clip();
  drawTrailTexture();
  ctx.restore();

  drawTrailEdges(left, right);
}

function drawTrailTexture() {
  for (const mark of groundMarks) {
    const depth = (mark.d + state.time * 0.006 * state.speed) % 1;
    const y = trailY(depth);
    const half = trailHalfWidth(y);
    const x = trailCenter(y) + mark.x * half * 0.82 + Math.sin(mark.seed) * 22 * depth;
    const s = 0.22 + depth * 1.6;

    if (mark.kind === 0) {
      ctx.strokeStyle = `rgba(28, 19, 12, ${0.16 + depth * 0.18})`;
      ctx.lineWidth = 2 + s * 4;
      ctx.beginPath();
      ctx.moveTo(x - 26 * s, y);
      ctx.quadraticCurveTo(x, y + 10 * s, x + 32 * s, y + 4 * s);
      ctx.stroke();
    } else if (mark.kind === 1) {
      ctx.fillStyle = `rgba(116, 91, 46, ${0.25 + depth * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 16 * s, 5 * s, Math.sin(mark.seed), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(32, 25, 16, ${0.18 + depth * 0.18})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 + s * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < 38; i += 1) {
    const depth = (i * 0.037 + state.time * 0.0065 * state.speed) % 1;
    const y = trailY(depth);
    const half = trailHalfWidth(y);
    const x = trailCenter(y) + Math.sin(i * 2.43) * half * 0.72;
    const s = 0.18 + depth * 1.5;
    ctx.fillStyle = i % 3 ? `rgba(64, 38, 20, ${0.14 + depth * 0.16})` : `rgba(118, 78, 35, ${0.12 + depth * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 28 * s, 7 * s, Math.sin(i) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrailEdges(left, right) {
  ctx.strokeStyle = hasPhotoBackground() ? "rgba(20, 28, 15, 0.38)" : "rgba(19, 28, 14, 0.82)";
  ctx.lineWidth = hasPhotoBackground() ? 10 : 18;
  ctx.lineCap = "round";
  for (const edge of [left, right]) {
    ctx.beginPath();
    edge.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.lineWidth = hasPhotoBackground() ? 3 : 5;
  ctx.strokeStyle = hasPhotoBackground() ? "rgba(183, 149, 83, 0.14)" : "rgba(130, 105, 52, 0.24)";
  for (const edge of [left, right]) {
    ctx.beginPath();
    edge.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function drawTrees() {
  const rows = treeRows
    .map((tree) => ({ ...tree, depth: (tree.offset + state.time * 0.0027 * state.speed) % 1 }))
    .sort((a, b) => a.depth - b.depth);

  for (const tree of rows) {
    const y = trailY(tree.depth);
    const half = trailHalfWidth(y);
    const x = trailCenter(y) + tree.side * (half + 40 + tree.depth * 420 + Math.sin(tree.seed) * 38);
    const scale = (0.28 + tree.depth * 1.85) * tree.bulk;
    drawTree(x, y + 52 * tree.depth, scale, tree);
  }
}

function drawTree(x, y, scale, tree) {
  const trunkH = 225 * scale;
  const trunkW = 22 * scale;
  const lean = tree.lean * scale * 45;

  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, lean / trunkH, 1, 0, 0);

  const trunk = ctx.createLinearGradient(-trunkW, -trunkH, trunkW, 0);
  trunk.addColorStop(0, "#2a1a10");
  trunk.addColorStop(0.48, "#5b3921");
  trunk.addColorStop(1, "#1e130c");
  ctx.fillStyle = trunk;
  ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);

  ctx.strokeStyle = "rgba(18, 10, 6, 0.55)";
  ctx.lineWidth = Math.max(1, 2.5 * scale);
  for (let i = 0; i < 5; i += 1) {
    const bx = -trunkW * 0.3 + i * trunkW * 0.17;
    ctx.beginPath();
    ctx.moveTo(bx, -trunkH);
    ctx.bezierCurveTo(bx + Math.sin(i) * 10 * scale, -trunkH * 0.65, bx - 7 * scale, -trunkH * 0.3, bx + 4 * scale, 0);
    ctx.stroke();
  }

  for (let i = 0; i < 4; i += 1) {
    const branchY = -trunkH * (0.42 + i * 0.13);
    const side = i % 2 ? 1 : -1;
    ctx.strokeStyle = "#2b1a0f";
    ctx.lineWidth = 8 * scale * (1 - i * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, branchY);
    ctx.quadraticCurveTo(side * 42 * scale, branchY - 24 * scale, side * 92 * scale, branchY - 42 * scale);
    ctx.stroke();
  }

  ctx.restore();

  const foliageY = y - trunkH * 0.72;
  const tones = ["rgba(19, 62, 35, 0.94)", "rgba(29, 82, 43, 0.9)", "rgba(12, 45, 28, 0.95)"];
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = tones[(i + Math.floor(tree.seed)) % tones.length];
    ctx.beginPath();
    ctx.ellipse(
      x + Math.sin(tree.seed + i) * 48 * scale,
      foliageY - i * 24 * scale,
      96 * scale * (1 - i * 0.06),
      44 * scale,
      Math.sin(tree.seed + i) * 0.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawObstacle(obstacle) {
  if (obstacle.depth < 0) return;
  const pos = laneToScreen(obstacle.lane, obstacle.depth);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.scale(pos.scale, pos.scale);
  ctx.rotate(Math.sin(obstacle.wobble + state.time * 0.02) * 0.05);

  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 20, 62, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obstacle.type === "branch") {
    ctx.strokeStyle = "#4e2f19";
    ctx.lineCap = "round";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(-62, -4);
    ctx.quadraticCurveTo(-14, -28, 62, 10);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.lineTo(36, -58);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120, 82, 45, 0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-58, -10);
    ctx.quadraticCurveTo(-12, -25, 57, 4);
    ctx.stroke();
  } else if (obstacle.type === "stump") {
    const bark = ctx.createLinearGradient(-38, -60, 38, 24);
    bark.addColorStop(0, "#2c1a0e");
    bark.addColorStop(0.5, "#6b4324");
    bark.addColorStop(1, "#24150c");
    ctx.fillStyle = bark;
    ctx.fillRect(-34, -62, 68, 74);
    ctx.fillStyle = "#9a7042";
    ctx.beginPath();
    ctx.ellipse(0, -62, 36, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(44, 25, 13, 0.65)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -62, 22, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#464b42";
    ctx.beginPath();
    ctx.moveTo(-44, 14);
    ctx.lineTo(-26, -30);
    ctx.lineTo(22, -39);
    ctx.lineTo(58, -4);
    ctx.lineTo(32, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(222, 226, 205, 0.16)";
    ctx.beginPath();
    ctx.ellipse(-8, -18, 25, 8, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStar(star) {
  if (star.depth < 0) return;
  const pos = laneToScreen(star.lane, star.depth);
  ctx.save();
  ctx.translate(pos.x, pos.y - 42 * pos.scale);
  ctx.rotate(star.spin);
  ctx.scale(pos.scale, pos.scale);

  const shine = ctx.createRadialGradient(0, 0, 5, 0, 0, 58);
  shine.addColorStop(0, "rgba(255, 251, 177, 1)");
  shine.addColorStop(0.48, "rgba(255, 207, 82, 0.85)");
  shine.addColorStop(1, "rgba(255, 207, 82, 0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffe27a";
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 16 : 36;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBike() {
  const groundY = 622;
  const baseX = trailCenter(groundY) + state.playerX * 230;
  const baseY = groundY - state.jump * 190;
  const tilt = (state.targetX - state.playerX) * 0.45;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(tilt);

  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 83 + state.jump * 190, 92 - state.jump * 35, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const wheelX of [-54, 58]) {
    const tire = ctx.createRadialGradient(wheelX, 38, 8, wheelX, 38, 34);
    tire.addColorStop(0, "#5a5a55");
    tire.addColorStop(0.48, "#222");
    tire.addColorStop(1, "#050505");
    ctx.fillStyle = tire;
    ctx.beginPath();
    ctx.arc(wheelX, 38, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#77776f";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = i * Math.PI / 4 + state.time * 0.08;
      ctx.beginPath();
      ctx.moveTo(wheelX, 38);
      ctx.lineTo(wheelX + Math.cos(a) * 24, 38 + Math.sin(a) * 24);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#b82018";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-54, 35);
  ctx.lineTo(-8, -9);
  ctx.lineTo(55, 36);
  ctx.lineTo(12, 36);
  ctx.lineTo(-54, 35);
  ctx.stroke();

  const body = ctx.createLinearGradient(-34, -40, 58, 2);
  body.addColorStop(0, "#7e1510");
  body.addColorStop(0.45, "#e23a2d");
  body.addColorStop(1, "#68100c");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-27, -37, 76, 36, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 224, 110, 0.9)";
  ctx.fillRect(24, -30, 28, 13);

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(38, -29);
  ctx.lineTo(82, -62);
  ctx.stroke();

  ctx.fillStyle = "#1c5bb3";
  ctx.beginPath();
  ctx.ellipse(-4, -77, 24, 37, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efbf91";
  ctx.beginPath();
  ctx.arc(10, -119, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c62621";
  ctx.beginPath();
  ctx.arc(10, -123, 24, Math.PI, 0);
  ctx.lineTo(34, -122);
  ctx.quadraticCurveTo(19, -96, -10, -101);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDustAndLeaves() {
  for (const p of state.dust) {
    const color = p.tone > 0.45 ? "154, 119, 71" : "87, 68, 41";
    ctx.fillStyle = `rgba(${color}, ${p.life / 78})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const fleck of state.flecks) {
    ctx.fillStyle = `rgba(176, 125, 46, ${Math.min(0.5, fleck.life / 160)})`;
    ctx.beginPath();
    ctx.ellipse(fleck.x, fleck.y, fleck.r * 1.8, fleck.r, Math.sin(fleck.y) * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAtmosphere() {
  const mist = ctx.createLinearGradient(0, 160, 0, 520);
  mist.addColorStop(0, "rgba(221, 230, 206, 0.22)");
  mist.addColorStop(0.45, "rgba(221, 230, 206, 0.08)");
  mist.addColorStop(1, "rgba(221, 230, 206, 0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 140, W, 400);

  ctx.strokeStyle = "rgba(255, 230, 154, 0.08)";
  ctx.lineWidth = 28;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(760 + i * 78, 42);
    ctx.lineTo(450 + i * 44 + Math.sin(state.time * 0.01 + i) * 20, H);
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(W / 2, H * 0.52, 190, W / 2, H * 0.52, 760);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.72, "rgba(0, 0, 0, 0.1)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function render() {
  drawBackground();
  drawForestFloor();
  drawTrail();

  const sceneItems = [
    ...state.obstacles.map((item) => ({ type: "obstacle", item })),
    ...state.collectibles.map((item) => ({ type: "star", item })),
  ].sort((a, b) => a.item.depth - b.item.depth);

  if (!hasPhotoBackground()) drawTrees();
  drawDustAndLeaves();

  for (const entry of sceneItems) {
    if (entry.type === "obstacle") drawObstacle(entry.item);
    else drawStar(entry.item);
  }

  drawBike();
  drawAtmosphere();
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
