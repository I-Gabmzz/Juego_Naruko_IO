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
const startBtn = document.getElementById('start-game');

const keys = new Set();
const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

const ENEMY_TYPES = [
  { type: 'rogue', r: 15, hp: 26, speed: 84, damage: 20, color: '#be2d56', xp: 5 },
  { type: 'tank', r: 20, hp: 55, speed: 52, damage: 36, color: '#7f163d', xp: 10 },
  { type: 'swift', r: 12, hp: 18, speed: 130, damage: 14, color: '#ff648a', xp: 4 },
];

const UPGRADE_POOL = [
  {
    id: 'atk-speed',
    title: 'Manos rápidas',
    desc: 'Kunais 12% más rápidos.',
    apply: (s) => { s.player.attackSpeed *= 1.12; },
  },
  {
    id: 'atk-dmg',
    title: 'Kunai forjado',
    desc: '+20% daño de kunai.',
    apply: (s) => { s.player.kunaiDamage *= 1.2; },
  },
  {
    id: 'max-hp',
    title: 'Chakra reforzado',
    desc: '+24 vida máxima y curación parcial.',
    apply: (s) => {
      s.player.maxHp += 24;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 28);
    },
  },
  {
    id: 'move-speed',
    title: 'Paso relámpago',
    desc: '+12% velocidad de movimiento.',
    apply: (s) => { s.player.speed *= 1.12; },
  },
  {
    id: 'shuriken',
    title: 'Shuriken triple',
    desc: 'Reduce 10% el enfriamiento del triple disparo.',
    apply: (s) => { s.player.shurikenCooldown *= 0.9; },
  },
  {
    id: 'rasengan',
    title: 'Rasengan denso',
    desc: '+18% daño de rasengan.',
    apply: (s) => { s.player.rasenganDamage *= 1.18; },
  },
  {
    id: 'dash',
    title: 'Ninja evasivo',
    desc: 'Dash recarga 15% más rápido.',
    apply: (s) => { s.player.dashCooldown *= 0.85; },
  },
];

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

function initState() {
  state = {
    status: 'menu',
    player: {
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: 17,
      hp: 140,
      maxHp: 140,
      speed: 240,
      kunaiDamage: 18,
      attackSpeed: 1,
      shurikenCooldown: 3.8,
      rasenganDamage: 60,
      dashCooldown: 2.8,
      dashTimer: 0,
      invuln: 0,
    },
    enemies: [],
    projectiles: [],
    orbs: [],
    effects: [],
    wave: 1,
    kills: 0,
    elapsed: 0,
    exp: 0,
    level: 1,
    expToNext: 26,
    spawnTimer: 0,
    kunaiTimer: 0,
    shurikenTimer: 1.8,
    rasenganTimer: 6,
    gameOver: false,
    paused: false,
    selectingUpgrade: false,
  };
}

function showOverlay(msg) {
  overlayEl.textContent = msg;
}

function startGame() {
  initState();
  state.status = 'running';
  startScreen.classList.remove('visible');
  upgradeScreen.classList.remove('visible');
  restartBtn.hidden = true;
  showOverlay('Misión iniciada: sobrevive a las oleadas Akatsuki.');
  updateHUD();
}

function onGameOver() {
  state.status = 'gameover';
  state.gameOver = true;
  restartBtn.hidden = false;
  showOverlay(`Derrotado. Tiempo: ${Math.floor(state.elapsed)}s • Bajas: ${state.kills}.`);
}

function spawnEnemy() {
  const margin = 24;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -margin;
  } else if (side === 1) {
    x = canvas.width + margin;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = Math.random() * canvas.height;
  }

  const tRoll = Math.random();
  const baseType = tRoll < 0.14 + state.wave * 0.006 ? ENEMY_TYPES[1] : tRoll < 0.43 ? ENEMY_TYPES[2] : ENEMY_TYPES[0];
  const scale = 1 + state.elapsed * 0.011;

  state.enemies.push({
    x,
    y,
    r: baseType.r,
    hp: baseType.hp * scale,
    maxHp: baseType.hp * scale,
    speed: baseType.speed + state.wave * 2.8,
    damage: baseType.damage,
    color: baseType.color,
    xp: baseType.xp,
    dead: false,
  });
}

function getNearestEnemy() {
  if (state.enemies.length === 0) return null;
  const p = state.player;
  let best = Infinity;
  let nearest = null;
  for (const enemy of state.enemies) {
    const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d < best) {
      best = d;
      nearest = enemy;
    }
  }
  return nearest;
}

function fireKunai() {
  const target = getNearestEnemy();
  if (!target) return;
  const p = state.player;
  const vx = target.x - p.x;
  const vy = target.y - p.y;
  const d = Math.hypot(vx, vy) || 1;
  const speed = 520;

  state.projectiles.push({
    kind: 'kunai',
    x: p.x,
    y: p.y,
    vx: (vx / d) * speed,
    vy: (vy / d) * speed,
    r: 5,
    damage: state.player.kunaiDamage,
    life: 1.2,
    color: '#ffcf5b',
    pierce: 0,
  });
}

function fireShurikenBurst() {
  const target = getNearestEnemy();
  if (!target) return;

  const p = state.player;
  const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);

  for (const offset of [-0.24, 0, 0.24]) {
    const angle = baseAngle + offset;
    state.projectiles.push({
      kind: 'shuriken',
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * 470,
      vy: Math.sin(angle) * 470,
      r: 6,
      damage: state.player.kunaiDamage * 0.78,
      life: 1.45,
      color: '#88d8ff',
      pierce: 1,
    });
  }

  state.effects.push({
    type: 'ring', x: p.x, y: p.y, r: 8, maxR: 36, life: 0.25, color: '#6fd4ff',
  });
}

function castRasenganPulse() {
  const p = state.player;
  const radius = 110;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d <= radius + enemy.r) {
      enemy.hp -= state.player.rasenganDamage;
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.dead = true;
        state.kills += 1;
        state.orbs.push({ x: enemy.x, y: enemy.y, r: 6, value: enemy.xp, collected: false });
      }
    }
  }

  state.effects.push({
    type: 'ring', x: p.x, y: p.y, r: 16, maxR: radius, life: 0.42, color: '#66f8ff',
  });
  showOverlay('¡Rasengan explosivo!');
}

function spawnLevelUpChoices() {
  state.selectingUpgrade = true;
  state.paused = true;
  upgradeOptions.innerHTML = '';

  const choices = pickRandom(UPGRADE_POOL, 3);
  choices.forEach((upgrade) => {
    const btn = document.createElement('button');
    btn.innerHTML = `${upgrade.title}<span>${upgrade.desc}</span>`;
    btn.addEventListener('click', () => {
      upgrade.apply(state);
      state.selectingUpgrade = false;
      state.paused = false;
      upgradeScreen.classList.remove('visible');
      showOverlay(`Mejora aplicada: ${upgrade.title}.`);
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
    state.wave = Math.max(state.wave, 1 + Math.floor(state.level / 3));
    state.expToNext = Math.floor(state.expToNext * 1.34 + 8);
    spawnLevelUpChoices();
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

  if (state.kunaiTimer <= 0) {
    fireKunai();
    state.kunaiTimer = Math.max(0.13, 0.56 / p.attackSpeed);
  }

  if (state.shurikenTimer <= 0) {
    fireShurikenBurst();
    state.shurikenTimer = Math.max(1.3, p.shurikenCooldown);
  }

  if (state.rasenganTimer <= 0) {
    castRasenganPulse();
    state.rasenganTimer = 7.4;
  }

  for (const enemy of state.enemies) {
    const vx = p.x - enemy.x;
    const vy = p.y - enemy.y;
    const d = Math.hypot(vx, vy) || 1;

    enemy.x += (vx / d) * enemy.speed * dt;
    enemy.y += (vy / d) * enemy.speed * dt;

    if (!state.player.invuln && d < enemy.r + p.r) {
      p.hp -= enemy.damage * dt;
    }
  }

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const d = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
      if (d < projectile.r + enemy.r) {
        enemy.hp -= projectile.damage;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          state.kills += 1;
          state.orbs.push({ x: enemy.x, y: enemy.y, r: 6, value: enemy.xp, collected: false });
        }
        projectile.pierce -= 1;
        if (projectile.pierce < 0) {
          projectile.life = 0;
          break;
        }
      }
    }
  }

  for (const orb of state.orbs) {
    const d = Math.hypot(p.x - orb.x, p.y - orb.y);
    if (d < 170) {
      const pull = 200 + (170 - d) * 2;
      const vx = p.x - orb.x;
      const vy = p.y - orb.y;
      const mag = Math.hypot(vx, vy) || 1;
      orb.x += (vx / mag) * pull * dt;
      orb.y += (vy / mag) * pull * dt;
    }
    if (d < p.r + orb.r + 5) {
      orb.collected = true;
      state.exp += orb.value;
      state.effects.push({
        type: 'spark', x: orb.x, y: orb.y, life: 0.25, color: '#70efff',
      });
    }
  }

  for (const fx of state.effects) {
    fx.life -= dt;
    if (fx.type === 'ring') {
      const ratio = Math.max(0, fx.life / 0.42);
      fx.r = fx.maxR * (1 - ratio);
    }
  }

  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  state.projectiles = state.projectiles.filter((pjt) => pjt.life > 0 && pjt.x > -20 && pjt.y > -20 && pjt.x < canvas.width + 20 && pjt.y < canvas.height + 20);
  state.orbs = state.orbs.filter((orb) => !orb.collected);
  state.effects = state.effects.filter((fx) => fx.life > 0);

  levelUpIfNeeded();

  if (p.hp <= 0) {
    p.hp = 0;
    onGameOver();
  }

  updateHUD();
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0e1937');
  grd.addColorStop(1, '#070e20');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(77, 112, 184, 0.24)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = '#ffb448';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1304';
  ctx.beginPath();
  ctx.arc(-5, -3, 2, 0, Math.PI * 2);
  ctx.arc(5, -3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1b1303';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 4, 5.5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  if (state.player.invuln > 0) {
    ctx.strokeStyle = 'rgba(95, 227, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = '#101319';
  ctx.fillRect(p.x - 30, p.y + 21, 60, 7);
  ctx.fillStyle = hpRatio < 0.3 ? '#ff5b6e' : '#65f5a1';
  ctx.fillRect(p.x - 30, p.y + 21, 60 * hpRatio, 7);
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();

    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = '#200813';
    ctx.fillRect(enemy.x - 17, enemy.y - enemy.r - 10, 34, 4);
    ctx.fillStyle = '#ff6383';
    ctx.fillRect(enemy.x - 17, enemy.y - enemy.r - 10, 34 * hpRatio, 4);
  }
}

function drawProjectiles() {
  for (const pjt of state.projectiles) {
    ctx.fillStyle = pjt.color;
    if (pjt.kind === 'kunai') {
      ctx.fillRect(pjt.x - 6, pjt.y - 2, 12, 4);
    } else {
      ctx.beginPath();
      ctx.arc(pjt.x, pjt.y, pjt.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOrbs() {
  for (const orb of state.orbs) {
    ctx.fillStyle = '#7df4ff';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects() {
  for (const fx of state.effects) {
    if (fx.type === 'ring') {
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const alpha = Math.max(0, fx.life / 0.25);
      ctx.fillStyle = `rgba(112, 239, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 6 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGameOverLayer() {
  if (!state.gameOver) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 8);
  ctx.font = '24px Inter, sans-serif';
  ctx.fillStyle = '#ffd37a';
  ctx.fillText(`Supervivencia: ${Math.floor(state.elapsed)}s`, canvas.width / 2, canvas.height / 2 + 32);
}

function render() {
  if (!state) return;
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

  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  if (dx === 0 && dy === 0) dx = 1;

  const mag = Math.hypot(dx, dy) || 1;
  p.x += (dx / mag) * 110;
  p.y += (dy / mag) * 110;
  p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
  p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));

  p.invuln = 0.22;
  p.dashTimer = p.dashCooldown;
  state.effects.push({ type: 'ring', x: p.x, y: p.y, r: 10, maxR: 52, life: 0.2, color: '#90f5ff' });
}

function togglePause() {
  if (state.status !== 'running' || state.selectingUpgrade || state.gameOver) return;
  state.paused = !state.paused;
  showOverlay(state.paused ? 'Pausa táctica (P para continuar).' : 'Combate reanudado.');
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (moveKeys.includes(key)) {
    keys.add(key);
    e.preventDefault();
  }
  if (key === 'shift') dash();
  if (key === 'p') togglePause();
});

document.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

startBtn.addEventListener('click', () => {
  startGame();
});

restartBtn.addEventListener('click', () => {
  startGame();
});

function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updateGame(dt);
  render();

  requestAnimationFrame(loop);
}

initState();
updateHUD();
showOverlay('Pulsa "Comenzar misión" para iniciar.');
requestAnimationFrame(loop);
