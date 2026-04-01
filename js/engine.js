// ── Screen Shake ──────────────────────────────
let shakeFrames = 0;
let shakeIntensity = 0;
let hitStopFrames = 0;

function triggerHitStop(frames) { hitStopFrames = frames; }

function triggerShake(intensity, frames) {
  shakeFrames = frames;
  shakeIntensity = intensity;
}


// ── Particle System ───────────────────────────
let particles = [];

function spawnParticles(x, y, color, count, isSuper) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = isSuper
      ? 3 + Math.random() * 8
      : 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (isSuper ? 3 : 1),
      life: 1,
      decay: isSuper ? 0.025 : 0.04,
      r: isSuper ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
      color,
      isSuper
    });
  }
}

function spawnBlood(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 1.6; // fan upward
    const speed = 2 + Math.random() * 6;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 1,
      decay: 0.03 + Math.random() * 0.03,
      r: 2 + Math.random() * 4,
      color: Math.random() > 0.3 ? '#cc0000' : '#ff4444',
      isSuper: false,
      isBlood: true,
    });
  }
}


function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.isBlood ? 0.35 : 0.15;
    p.vx *= p.isBlood ? 0.88 : 0.95;
    if (p.isBlood && p.y >= GROUND) {
      p.y = GROUND;
      p.vy = 0; p.vx = 0;
      p.decay = 0.005;
    }
    p.life -= p.decay;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    if (p.isSuper) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 8;
    }
    const r = Math.max(0.1, p.r * p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}


// ── Physics ───────────────────────────────────
function applyPhysics(f) {
  f.vy += f.gravity;
  f.x  += f.vx;
  f.y  += f.vy;

  if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; f.onGround = true; }
  f.x = Math.max(0, Math.min(W - f.w, f.x));

  if (f.attackTimer > 0) f.attackTimer--;
  if (f.attackTimer === 0) f.attacking = false;
  if (f.attackCooldown > 0) f.attackCooldown--;

  if (f.specialTimer > 0) f.specialTimer--;
  if (f.specialTimer === 0) f.specialAttacking = false;
  if (f.specialCooldown > 0) f.specialCooldown--;

  if (f.hitFlash > 0) f.hitFlash--;
  if (f.whiteFlash > 0) f.whiteFlash--;

  if (f.comboTimer > 0) {
    f.comboTimer--;
    if (f.comboTimer === 0) f.comboCount = 0;
  }
}

