// ── Parallax Background ──────────────────────────────
let skyCanvas = null;
let cityBgCanvas = null;
let cityCanvas = null; // Ground

function buildCityCanvas() {
  const extW = W * 1.5; // Wider for parallax drift

  // 1. Sky Canvas
  skyCanvas = document.createElement('canvas');
  skyCanvas.width = extW; skyCanvas.height = H;
  const sx = skyCanvas.getContext('2d');
  const sky = sx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0,'#06060f');
  sky.addColorStop(1,'#0c0c28');
  sx.fillStyle = sky;
  sx.fillRect(0, 0, extW, H);

  for (let i = 0; i < 90; i++) {
    const stx = Math.random() * extW;
    const sty = Math.random() * GROUND * 0.6;
    const sr = Math.random() * 1.2;
    sx.beginPath(); sx.arc(stx, sty, sr, 0, Math.PI*2);
    sx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; sx.fill();
  }

  // 2. City Canvas
  cityBgCanvas = document.createElement('canvas');
  cityBgCanvas.width = extW; cityBgCanvas.height = H;
  const cx2 = cityBgCanvas.getContext('2d');
  
  const widerBuildings = [];
  for(let bx = 0; bx < extW; bx += 50 + Math.random() * 70) {
     widerBuildings.push([bx, 70 + Math.random() * 90, 40 + Math.random() * 50]);
  }

  widerBuildings.forEach(([bx,by,bw]) => {
    cx2.fillStyle = '#0d0d1e';
    cx2.fillRect(bx, by, bw, GROUND - by);
    for (let wy = by + 10; wy < GROUND - 18; wy += 14) {
      for (let wx = bx + 4; wx < bx + bw - 8; wx += 10) {
        if (Math.random() > 0.45) {
          const lit = Math.random();
          cx2.fillStyle = lit > 0.85 ? 'rgba(0,207,255,0.25)' : lit > 0.65 ? 'rgba(255,230,0,0.15)' : 'rgba(255,255,255,0.07)';
          cx2.fillRect(wx, wy, 5, 8);
        }
      }
    }
  });

  // 3. Ground Canvas (Static)
  cityCanvas = document.createElement('canvas');
  cityCanvas.width = W; cityCanvas.height = H;
  const cx3 = cityCanvas.getContext('2d');
  const grd = cx3.createLinearGradient(0, GROUND, 0, H);
  grd.addColorStop(0,'#181830');
  grd.addColorStop(1,'#08081a');
  cx3.fillStyle = grd;
  cx3.fillRect(0, GROUND, W, H - GROUND);
  cx3.strokeStyle = 'rgba(0,207,255,0.3)';
  cx3.lineWidth = 2;
  cx3.beginPath(); cx3.moveTo(0, GROUND); cx3.lineTo(W, GROUND); cx3.stroke();
}

function drawBackground() {
  if (!cityCanvas) buildCityCanvas();

  const midX = (player.x + enemy.x) / 2;
  const drift = (midX - (W/2)); // 0 when in center, positive when right

  // Center offset to align canvases
  const baseOffset = (W - (W * 1.5)) / 2;

  ctx.drawImage(skyCanvas, baseOffset - (drift * 0.05), 0);
  ctx.drawImage(cityBgCanvas, baseOffset - (drift * 0.2), 0);
  ctx.drawImage(cityCanvas, 0, 0); // Ground doesn't drift
}


// ── Attack Effects ────────────────────────────
function drawAttackEffect(f) {
  if (!f.attacking) return;
  // Show for the FULL attack duration (not just half)
  const progress = f.attackTimer / ATTACK_FRAMES; // 1→0 as it fades
  const alpha = Math.max(0, progress); // stays visible the whole time

  const cx = f.x + f.w/2 + f.facing * 64;
  const cy = f.y - f.h * 0.55;

  let col = f.isPlayer ? '#ffee44' : '#00ffee';
  let colGlow = f.isPlayer ? '#ffaa00' : '#00cfff';
  
  if (f.attackType === 'kick') {
    col = f.isPlayer ? '#ff4444' : '#ee00ff'; // Red for player kick, Purple for enemy kick
    colGlow = f.isPlayer ? '#aa0000' : '#aa00cc';
  }

  ctx.save();

  // 1. Big slash arc — full duration
  ctx.globalAlpha = Math.min(1, alpha + 0.2);
  ctx.strokeStyle = col;
  ctx.lineWidth   = 6 + (1 - progress) * 4;
  ctx.shadowColor = colGlow;
  ctx.shadowBlur  = 30;
  ctx.lineCap = 'round';

  // Main arc
  ctx.beginPath();
  ctx.arc(cx, cy, 38, -Math.PI * 0.8, Math.PI * 0.4);
  ctx.stroke();

  // Cross slash lines for more impact
  ctx.lineWidth = 3;
  ctx.globalAlpha = alpha * 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - f.facing * 20, cy - 30);
  ctx.lineTo(cx + f.facing * 20, cy + 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + f.facing * 20, cy - 20);
  ctx.lineTo(cx - f.facing * 10, cy + 25);
  ctx.stroke();

  // 2. Spark dots around arc
  ctx.shadowBlur = 0;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.8 + (i / 6) * (Math.PI * 1.2);
    const sx = cx + Math.cos(a) * 38;
    const sy = cy + Math.sin(a) * 38;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, 3 + (1-progress)*2, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.fill();
  }

  // 3. "POW!" / "HIT!" text popup on first half of attack
  if (progress > 0.4) {
    const label = f.isPlayer ? 'POW!' : 'HIT!';
    const popAlpha = (progress - 0.4) / 0.6;
    const popY = cy - 20 - (1 - progress) * 25; // floats up
    ctx.globalAlpha = popAlpha;
    ctx.shadowColor = colGlow;
    ctx.shadowBlur  = 20;
    ctx.font = `900 ${18 + (1-progress)*8}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = col;
    ctx.fillText(label, cx, popY);
  }

  ctx.restore();
}

function drawFFAHeadHud(f) {
  const cx = f.x + f.w / 2;
  const topY = f.y - (f.isCrouching ? 54 : 82) - 30; // Float above head
  
  ctx.save();
  // Name
  ctx.font = '700 12px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = f.isClientMe || (isHost && fighters.indexOf(f) === 0) ? '#ffea00' : '#ffffff';
  ctx.fillText(f.name || `PLAYER ${fighters.indexOf(f) + 1}`, cx, topY - 8);

  // Background Bar
  ctx.fillStyle = '#111';
  ctx.fillRect(cx - 24, topY, 48, 6);
  
  // Health Bar (Red/Blood)
  const hpRatio = Math.max(0, f.health / f.maxHealth);
  ctx.fillStyle = (f.hitFlash > 0 && f.hitFlash % 2) ? '#ffffff' : '#ff0033';
  ctx.fillRect(cx - 24, topY, 48 * hpRatio, 6);
  
  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 24, topY, 48, 6);
  
  ctx.restore();
}

function drawSpecialEffect(f) {
  if (!f.specialAttacking) return;
  const progress = f.specialTimer / SPECIAL_FRAMES;
  const cx = f.x + f.w/2;
  const cy = f.y - f.h/2;
  const reach = f.facing * (SPECIAL_REACH * (1 - progress * 0.3));

  ctx.save();
  ctx.globalAlpha = 0.85;

  // Energy trail
  const grad = ctx.createLinearGradient(cx, cy, cx + reach, cy);
  grad.addColorStop(0, '#bf5fff');
  grad.addColorStop(0.5, '#ff80ff');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 10 * progress;
  ctx.shadowColor = '#bf5fff';
  ctx.shadowBlur  = 24;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + reach, cy);
  ctx.stroke();

  // Outer glow ring
  ctx.globalAlpha = progress * 0.6;
  ctx.strokeStyle = '#ff80ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 44 * (1 - progress * 0.5), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}


// ── Fighter Draw ──────────────────────────────
function drawFighter(f) {
  ctx.save();
  
  f.h = f.isCrouching ? 54 : 82;

  // White flash on super hit
  if (f.whiteFlash > 0) {
    ctx.globalAlpha = f.whiteFlash > 3 ? 1 : 0.5;
  } else if (f.hitFlash > 0 && f.hitFlash % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }

  const cx   = f.x + f.w/2;
  const topY = f.y - f.h;
  const headR = 15;
  const headCY = topY + headR + 4;

  // Shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, f.y + 2, f.w * 0.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = f.color;
  ctx.shadowBlur  = f.specialAttacking ? 30 : 10;

  // --- LEG RENDERING ---
  const legPhase = (Date.now() / 140) * (Math.abs(f.vx) > 0 ? 1 : 0);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  
  if (f.attacking && f.attackType === 'kick') {
    // Kick leg becomes distinct color!
    ctx.strokeStyle = f.isPlayer ? '#ff4444' : '#ee00ff';
    ctx.beginPath(); ctx.moveTo(cx, f.y - 28); ctx.lineTo(cx + f.facing * 45, f.y - 12); ctx.stroke();
    // Standing leg is normal color
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.moveTo(cx, f.y - 28); ctx.lineTo(cx - f.facing * 10, f.y); ctx.stroke();
  } else if (f.isCrouching) {
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.moveTo(cx, f.y - 20); ctx.lineTo(cx + 15, f.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, f.y - 20); ctx.lineTo(cx - 15, f.y); ctx.stroke();
  } else {
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.moveTo(cx, f.y - 28); ctx.lineTo(cx - 10 + Math.sin(legPhase)*10, f.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, f.y - 28); ctx.lineTo(cx + 10 - Math.sin(legPhase)*10, f.y); ctx.stroke();
  }

  // --- BODY RENDERING ---
  ctx.strokeStyle = f.color;
  const bodyBaseY = f.isCrouching ? f.y - 20 : f.y - 28;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx, bodyBaseY); ctx.lineTo(cx, headCY + headR); ctx.stroke();

  // --- ARM RENDERING ---
  ctx.lineWidth = 4;
  if (f.specialAttacking) {
    ctx.strokeStyle = '#bf5fff';
    // Both arms forward for special
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + f.facing * 50, headCY + headR + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + f.facing * 44, headCY + headR + 18); ctx.stroke();
  } else if (f.isBlocking) {
    ctx.strokeStyle = f.color;
    // Blocking pose: arms crossed or held up in front
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + f.facing * 18, headCY + headR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + f.facing * 18, headCY + headR + 16); ctx.stroke();
  } else if (f.attacking && f.attackType === 'punch') {
    // Punch arm becomes distinct color!
    ctx.strokeStyle = f.isPlayer ? '#ffee44' : '#00ffee';
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + f.facing * 40, headCY + headR); ctx.stroke();
    // Back arm is normal color
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx - f.facing * 14, headCY + headR + 16); ctx.stroke();
  } else {
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx + 18, headCY + headR + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, headCY + headR + 8); ctx.lineTo(cx - 18, headCY + headR + 22); ctx.stroke();
  }

  // Head base
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fillStyle = f.color;
  ctx.fill();

  // Avatar face on head
  let av = f.customAvatar;
  if (!av && !isFFA) av = f.isPlayer ? hostAvatarImg : clientAvatarImg;
  
  if (av && av.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, headCY, headR - 1, 0, Math.PI * 2);
    ctx.clip();
    if (f.facing === -1) {
      ctx.translate(cx * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(av, cx - headR, headCY - headR, headR*2, headR*2);
    ctx.restore();
  } else {
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx + f.facing * 5, headCY - 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx + f.facing * 6, headCY - 2, 2, 0, Math.PI*2); ctx.fill();
  }

  ctx.restore();

  // Effects on top
  drawAttackEffect(f);
  drawSpecialEffect(f);

  // Draw combo
  if (f.comboCount > 1) {
    ctx.save();
    ctx.fillStyle = '#ff2d2d';
    ctx.font = '900 24px "Inter", sans-serif';
    ctx.shadowColor = '#ff2d2d';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO x${f.comboCount}!`, cx, f.y - f.h - 30);
    ctx.restore();
  }
}


// ── Round Announcer ───────────────────────────
let announceTimer = 0;
let announceText  = '';

function showAnnounce(text, frames) {
  announceText  = text;
  announceTimer = frames;
}

function drawAnnounce() {
  if (announceTimer <= 0) return;
  announceTimer--;
  const alpha = Math.min(1, announceTimer / 20);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '900 52px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe600';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 30;
  ctx.fillText(announceText, W/2, H/2 - 20);
  ctx.restore();
}

