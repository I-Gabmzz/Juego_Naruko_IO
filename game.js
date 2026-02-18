const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hpEl = document.getElementById('hp');
const levelEl = document.getElementById('level');
const expEl = document.getElementById('exp');
const timeEl = document.getElementById('time');
const killsEl = document.getElementById('kills');
const waveEl = document.getElementById('wave');
const overlayEl = document.getElementById('overlay');
const restartBtn = document.getElementById('restart');
const startScreen = document.getElementById('start-screen');
const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeOptions = document.getElementById('upgrade-options');
const upgradeTitle = document.getElementById('upgrade-title');
const upgradeSubtitle = document.getElementById('upgrade-subtitle');
const startBtn = document.getElementById('start-game');

const keys = new Set();
const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

function makeIcon(bg, symbol) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect x='0' y='0' width='64' height='64' rx='10' fill='${bg}'/><text x='32' y='43' text-anchor='middle' font-size='33'>${symbol}</text></svg>`)}`;
}

const COMMON_UPGRADES = [
  { title: 'Kunai forjado', desc: '+20% daño kunai', icon: makeIcon('#ffbb66', '🗡️'), apply: (s) => { s.player.kunaiDamage *= 1.2; } },
  { title: 'Ritmo ninja', desc: '+12% velocidad de ataque', icon: makeIcon('#9be9ff', '⚡'), apply: (s) => { s.player.attackSpeed *= 1.12; } },
  { title: 'Chakra vital', desc: '+26 vida máx + curación', icon: makeIcon('#9fffac', '💚'), apply: (s) => { s.player.maxHp += 26; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 34); } },
  { title: 'Paso veloz', desc: '+10% movimiento', icon: makeIcon('#d8b4ff', '👣'), apply: (s) => { s.player.speed *= 1.1; } },
  { title: 'Shuriken maestro', desc: '-12% cooldown shuriken', icon: makeIcon('#ffe88a', '⭐'), apply: (s) => { s.player.shurikenCooldown *= 0.88; } },
  { title: 'Rasengan denso', desc: '+18% daño rasengan', icon: makeIcon('#7be8ff', '🌀'), apply: (s) => { s.player.rasenganDamage *= 1.18; } },
];

const SPECIAL_UPGRADES = [
  { title: 'Modo sabio', desc: 'Ataque +25% y speed +15%', icon: makeIcon('#ffd16e', '🌟'), apply: (s) => { s.player.attackSpeed *= 1.25; s.player.speed *= 1.15; } },
  { title: 'Clon de sombra', desc: '+1 kunai adicional por disparo', icon: makeIcon('#8dc2ff', '👥'), apply: (s) => { s.player.extraKunai += 1; } },
  { title: 'Gran Rasengan', desc: 'Área rasengan +35% y daño +20%', icon: makeIcon('#65f2ff', '💥'), apply: (s) => { s.player.rasenganRadius *= 1.35; s.player.rasenganDamage *= 1.2; } },
  { title: 'Voluntad de fuego', desc: 'Recupera toda la vida y +35 hp máx', icon: makeIcon('#ff9b7a', '🔥'), apply: (s) => { s.player.maxHp += 35; s.player.hp = s.player.maxHp; } },
];

const ENEMY_TYPES = [
  { r: 16, hp: 26, speed: 84, damage: 20, color: '#be2d56', xp: 5 },
  { r: 21, hp: 56, speed: 52, damage: 36, color: '#7f163d', xp: 11 },
  { r: 13, hp: 18, speed: 132, damage: 14, color: '#ff648a', xp: 4 },
];

const spriteAssets = {
  player: { img: new Image(), loaded: false, cols: 6, rows: 5, path: 'assets/naruto.png' },
  enemy: { img: new Image(), loaded: false, cols: 5, rows: 7, path: 'assets/enemy_ninja.png' },
};

Object.values(spriteAssets).forEach((asset) => {
  asset.img.onload = () => { asset.loaded = true; };
  asset.img.onerror = () => { asset.loaded = false; };
  asset.img.src = asset.path;
});

let state;
let last = performance.now();

function pickRandom(array, amount) {
  const clone = [...array];
  const result = [];
  while (clone.length > 0 && result.length < amount) {
    const idx = Math.floor(Math.random() * clone.length);
    result.push(clone.splice(idx, 1)[0]);
  }
  return result;
}

function showOverlay(msg) {
  overlayEl.textContent = msg;
}

function initState() {
  state = {
    status: 'menu',
    player: {
      x: canvas.width / 2, y: canvas.height / 2, r: 18,
      hp: 150, maxHp: 150, speed: 248,
      attackSpeed: 1, kunaiDamage: 18, shurikenCooldown: 3.8,
      rasenganDamage: 66, rasenganRadius: 110,
      extraKunai: 0,
      dashCooldown: 2.8, dashTimer: 0, invuln: 0,
      anim: 0,
    },
    enemies: [], projectiles: [], orbs: [], effects: [],
    wave: 1, kills: 0, elapsed: 0,
    exp: 0, level: 1, expToNext: 26,
    spawnTimer: 0, kunaiTimer: 0, shurikenTimer: 1.6, rasenganTimer: 6,
    gameOver: false, paused: false, selectingUpgrade: false,
  };
}

function startGame() {
  initState();
  state.status = 'running';
  startScreen.classList.remove('visible');
  upgradeScreen.classList.remove('visible');
  restartBtn.hidden = true;
  showOverlay('Misión iniciada. Sube a nivel 5 para mejora; nivel 6 será especial.');
  updateHUD();
}

function onGameOver() {
  state.status = 'gameover';
  state.gameOver = true;
  restartBtn.hidden = false;
  showOverlay(`Derrotado. Tiempo ${Math.floor(state.elapsed)}s • Bajas ${state.kills}`);
}

function spawnEnemy() {
  const margin = 24;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) { x = Math.random() * canvas.width; y = -margin; }
  else if (side === 1) { x = canvas.width + margin; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + margin; }
  else { x = -margin; y = Math.random() * canvas.height; }

  const tRoll = Math.random();
  const base = tRoll < 0.18 + state.wave * 0.006 ? ENEMY_TYPES[1] : tRoll < 0.45 ? ENEMY_TYPES[2] : ENEMY_TYPES[0];
  const scale = 1 + state.elapsed * 0.011;
  state.enemies.push({
    x, y, r: base.r, hp: base.hp * scale, maxHp: base.hp * scale,
    speed: base.speed + state.wave * 2.6, damage: base.damage,
    color: base.color, xp: base.xp, dead: false, anim: Math.random() * 10,
  });
}

function getNearestEnemy() {
  if (state.enemies.length === 0) return null;
  const p = state.player;
  let best = Infinity;
  let nearest = null;
  for (const enemy of state.enemies) {
    const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d < best) { best = d; nearest = enemy; }
  }
  return nearest;
}

function fireKunai() {
  const target = getNearestEnemy();
  if (!target) return;
  const p = state.player;
  const baseA = Math.atan2(target.y - p.y, target.x - p.x);
  const shotCount = 1 + state.player.extraKunai;
  for (let i = 0; i < shotCount; i += 1) {
    const spread = (i - (shotCount - 1) / 2) * 0.14;
    const a = baseA + spread;
    state.projectiles.push({ kind: 'kunai', x: p.x, y: p.y, vx: Math.cos(a) * 530, vy: Math.sin(a) * 530, r: 5, damage: p.kunaiDamage, life: 1.2, color: '#ffcf5b', pierce: 0 });
  }
}

function fireShurikenBurst() {
  const target = getNearestEnemy();
  if (!target) return;
  const p = state.player;
  const baseA = Math.atan2(target.y - p.y, target.x - p.x);
  for (const offset of [-0.24, 0, 0.24]) {
    const a = baseA + offset;
    state.projectiles.push({ kind: 'shuriken', x: p.x, y: p.y, vx: Math.cos(a) * 475, vy: Math.sin(a) * 475, r: 6, damage: p.kunaiDamage * 0.8, life: 1.45, color: '#88d8ff', pierce: 1 });
  }
}

function castRasenganPulse() {
  const p = state.player;
  const radius = p.rasenganRadius;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d <= radius + enemy.r) {
      enemy.hp -= p.rasenganDamage;
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        state.kills += 1;
        state.orbs.push({ x: enemy.x, y: enemy.y, r: 6, value: enemy.xp, collected: false });
      }
    }
  }
  state.effects.push({ type: 'ring', x: p.x, y: p.y, r: 16, maxR: radius, life: 0.45, color: '#66f8ff' });
}

function openUpgradeScreen(pool, special) {
  state.selectingUpgrade = true;
  state.paused = true;
  upgradeOptions.innerHTML = '';
  upgradeTitle.textContent = special ? 'Mejora especial' : 'Subida de nivel';
  upgradeSubtitle.textContent = special ? 'Nivel múltiplo de 6: elige poder especial' : 'Nivel múltiplo de 5: elige una mejora';

  const choices = pickRandom(pool, 3);
  choices.forEach((up) => {
    const btn = document.createElement('button');
    btn.innerHTML = `<img src="${up.icon}" alt="icono mejora" /><div><strong>${up.title}</strong><span>${up.desc}</span></div>`;
    btn.addEventListener('click', () => {
      up.apply(state);
      state.selectingUpgrade = false;
      state.paused = false;
      upgradeScreen.classList.remove('visible');
      showOverlay(`${special ? 'Especial' : 'Mejora'} aplicada: ${up.title}`);
      updateHUD();
    });
    upgradeOptions.appendChild(btn);
  });

  upgradeScreen.classList.add('visible');
}

function levelUpIfNeeded() {
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level += 1;
    state.expToNext = Math.floor(state.expToNext * 1.32 + 9);
    state.player.maxHp += 3;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 6);

    if (state.level % 6 === 0) {
      openUpgradeScreen(SPECIAL_UPGRADES, true);
    } else if (state.level % 5 === 0) {
      openUpgradeScreen(COMMON_UPGRADES, false);
    }
  }
}

function processInput(dt) {
  const p = state.player;
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  const mag = Math.hypot(dx, dy) || 1;
  p.x += (dx / mag) * p.speed * dt;
  p.y += (dy / mag) * p.speed * dt;
  p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
  p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));
  p.anim += dt * (dx || dy ? 13 : 7);
}

function updateGame(dt) {
  if (state.status !== 'running' || state.paused || state.gameOver) return;
  state.elapsed += dt;
  state.wave = Math.max(1, 1 + Math.floor(state.elapsed / 22));

  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  processInput(dt);

  state.spawnTimer -= dt;
  state.kunaiTimer -= dt;
  state.shurikenTimer -= dt;
  state.rasenganTimer -= dt;

  if (state.spawnTimer <= 0) {
    const batch = 1 + Math.floor(state.wave / 2);
    for (let i = 0; i < batch; i += 1) spawnEnemy();
    state.spawnTimer = Math.max(0.16, 0.92 - state.wave * 0.04);
  }
  if (state.kunaiTimer <= 0) { fireKunai(); state.kunaiTimer = Math.max(0.12, 0.56 / p.attackSpeed); }
  if (state.shurikenTimer <= 0) { fireShurikenBurst(); state.shurikenTimer = Math.max(1.2, p.shurikenCooldown); }
  if (state.rasenganTimer <= 0) { castRasenganPulse(); state.rasenganTimer = 7.2; }

  for (const e of state.enemies) {
    const vx = p.x - e.x;
    const vy = p.y - e.y;
    const d = Math.hypot(vx, vy) || 1;
    e.x += (vx / d) * e.speed * dt;
    e.y += (vy / d) * e.speed * dt;
    e.anim += dt * 10;
    if (!p.invuln && d < e.r + p.r) p.hp -= e.damage * dt;
  }

  for (const pj of state.projectiles) {
    pj.x += pj.vx * dt;
    pj.y += pj.vy * dt;
    pj.life -= dt;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(pj.x - e.x, pj.y - e.y);
      if (d < pj.r + e.r) {
        e.hp -= pj.damage;
        if (e.hp <= 0) {
          e.dead = true;
          state.kills += 1;
          state.orbs.push({ x: e.x, y: e.y, r: 6, value: e.xp, collected: false });
        }
        pj.pierce -= 1;
        if (pj.pierce < 0) { pj.life = 0; break; }
      }
    }
  }

  for (const orb of state.orbs) {
    const d = Math.hypot(p.x - orb.x, p.y - orb.y);
    if (d < 170) {
      const pull = 200 + (170 - d) * 2;
      const vx = p.x - orb.x;
      const vy = p.y - orb.y;
      const m = Math.hypot(vx, vy) || 1;
      orb.x += (vx / m) * pull * dt;
      orb.y += (vy / m) * pull * dt;
    }
    if (d < p.r + orb.r + 5) { orb.collected = true; state.exp += orb.value; }
  }

  for (const fx of state.effects) {
    fx.life -= dt;
    if (fx.type === 'ring') {
      const ratio = Math.max(0, fx.life / 0.45);
      fx.r = fx.maxR * (1 - ratio);
    }
  }

  state.enemies = state.enemies.filter((e) => !e.dead);
  state.projectiles = state.projectiles.filter((pjt) => pjt.life > 0 && pjt.x > -20 && pjt.y > -20 && pjt.x < canvas.width + 20 && pjt.y < canvas.height + 20);
  state.orbs = state.orbs.filter((orb) => !orb.collected);
  state.effects = state.effects.filter((fx) => fx.life > 0);

  levelUpIfNeeded();
  if (p.hp <= 0) { p.hp = 0; onGameOver(); }
  updateHUD();
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0e1937');
  grd.addColorStop(1, '#070e20');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(77, 112, 184, 0.24)';
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function drawSprite(asset, frameX, frameY, dx, dy, dw, dh, flip = false) {
  if (!asset.loaded) return false;
  const fw = asset.img.width / asset.cols;
  const fh = asset.img.height / asset.rows;
  const sx = frameX * fw;
  const sy = frameY * fh;

  ctx.save();
  if (flip) {
    ctx.translate(dx + dw / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw / 2), 0);
  }
  ctx.drawImage(asset.img, sx, sy, fw, fh, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

function drawPlayer() {
  const p = state.player;
  const moving = Array.from(keys).some((k) => moveKeys.includes(k));
  const frame = Math.floor(p.anim) % 6;
  const row = moving ? 1 : 0;

  const facingLeft = keys.has('a') || keys.has('arrowleft');
  const used = drawSprite(spriteAssets.player, frame, row, p.x - 34, p.y - 42, 68, 84, facingLeft);

  if (!used) {
    ctx.fillStyle = '#ffb448';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = '#101319'; ctx.fillRect(p.x - 30, p.y + 27, 60, 7);
  ctx.fillStyle = hpRatio < 0.3 ? '#ff5b6e' : '#65f5a1'; ctx.fillRect(p.x - 30, p.y + 27, 60 * hpRatio, 7);

  if (p.invuln > 0) {
    ctx.strokeStyle = 'rgba(95,227,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawEnemies() {
  for (const e of state.enemies) {
    const frame = Math.floor(e.anim) % 5;
    const used = drawSprite(spriteAssets.enemy, frame, 2, e.x - 28, e.y - 30, 56, 60);
    if (!used) {
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#200813'; ctx.fillRect(e.x - 17, e.y - e.r - 10, 34, 4);
    ctx.fillStyle = '#ff6383'; ctx.fillRect(e.x - 17, e.y - e.r - 10, 34 * hpRatio, 4);
  }
}

function drawProjectiles() {
  for (const pjt of state.projectiles) {
    ctx.fillStyle = pjt.color;
    if (pjt.kind === 'kunai') ctx.fillRect(pjt.x - 6, pjt.y - 2, 12, 4);
    else { ctx.beginPath(); ctx.arc(pjt.x, pjt.y, pjt.r, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawOrbs() {
  for (const orb of state.orbs) {
    ctx.fillStyle = '#7df4ff';
    ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEffects() {
  for (const fx of state.effects) {
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawGameOverLayer() {
  if (!state.gameOver) return;
  ctx.fillStyle = 'rgba(0,0,0,0.56)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 52px Inter, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 8);
}

function render() {
  drawBackground();
  drawOrbs();
  drawPlayer();
  drawEnemies();
  drawProjectiles();
  drawEffects();
  drawGameOverLayer();
}

function updateHUD() {
  hpEl.textContent = `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`;
  levelEl.textContent = state.level;
  expEl.textContent = `${Math.floor(state.exp)} / ${state.expToNext}`;
  timeEl.textContent = `${Math.floor(state.elapsed)}s`;
  killsEl.textContent = state.kills;
  waveEl.textContent = state.wave;
}

function dash() {
  if (state.status !== 'running' || state.paused || state.gameOver) return;
  const p = state.player;
  if (p.dashTimer > 0) return;
  let dx = 0; let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (dx === 0 && dy === 0) dx = 1;
  const mag = Math.hypot(dx, dy) || 1;
  p.x += (dx / mag) * 110; p.y += (dy / mag) * 110;
  p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
  p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));
  p.invuln = 0.22;
  p.dashTimer = p.dashCooldown;
}

function togglePause() {
  if (state.status !== 'running' || state.selectingUpgrade || state.gameOver) return;
  state.paused = !state.paused;
  showOverlay(state.paused ? 'Pausa táctica (P para continuar)' : 'Combate reanudado');
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (moveKeys.includes(key)) { keys.add(key); e.preventDefault(); }
  if (key === 'shift') dash();
  if (key === 'p') togglePause();
});

document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  updateGame(dt);
  render();
  requestAnimationFrame(loop);
}

initState();
updateHUD();
showOverlay('Tip: coloca tus sprites en assets/naruto.png y assets/enemy_ninja.png');
requestAnimationFrame(loop);
