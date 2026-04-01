// ── Fighter Factory ───────────────────────────
function createFighter({ x, y, color, isPlayer, facing }) {
  return {
    x, y,
    w: 52, h: 82,
    vx: 0, vy: 0,
    speed: 5,
    jumpForce: -16,
    gravity: 0.68,
    onGround: false,
    health: 200,
    maxHealth: 200,
    energy: 0,        // 0–100
    maxEnergy: 100,
    comboCount: 0,
    comboTimer: 0,
    isPlayer,
    facing,
    color,
    isCrouching: false,
    isBlocking: false,
    attackType: 'punch', // 'punch', 'kick', 'special'
    // Normal attack
    attacking: false,
    attackTimer: 0,
    attackCooldown: 0,
    // Special attack
    specialAttacking: false,
    specialTimer: 0,
    specialCooldown: 0,
    hitFlash: 0,
    whiteFlash: 0,    // full-white flash on super hit
    // AI state
    aiTimer: 0,
    aiAction: 'idle',
    retreating: false,
  };
}

let player, enemy;
let fighters = [];

function initFighters() {
  player = createFighter({ x: W / 4,  y: GROUND, color: '#ff3a3a', isPlayer: true,  facing:  1 });
  enemy  = createFighter({ x: W * 0.75, y: GROUND, color: '#00cfff', isPlayer: false, facing: -1 });

  if (typeof isFFA !== 'undefined' && isFFA) {
    if (fighters.length === 0) {
       fighters = [player];
    } else {
       // Reset existing fighters rather than destroying the array
       for (let i = 0; i < fighters.length; i++) {
          let f = fighters[i];
          f.health = f.maxHealth;
          f.energy = 0;
          f.x = 200 + (Math.random() * (W - 400));
          f.y = GROUND;
          f.vx = 0; f.vy = 0;
       }
       fighters[0] = player; // keep host updated
    }
  } else {
    fighters = [player, enemy]; // Standard 1v1 Mode
  }
}


// ── AI ────────────────────────────────────────
function handleAI(f, target) {
  f.aiTimer--;
  if (f.aiTimer > 0) return;
  f.aiTimer = 30 + (Math.random() * 40 | 0);

  const dx   = target.x - f.x;
  const dist = Math.abs(dx);
  const lowHP = f.health < (f.maxHealth * 0.3);

  // Retreat when hurt
  if (lowHP && Math.random() < 0.5) {
    f.aiAction = 'retreat';
    return;
  }
  f.retreating = false;

  if (dist > 200)      f.aiAction = 'chase';
  else if (dist < 75)  f.aiAction = Math.random() < 0.6 ? 'attack' : 'jump_back';
  else                 f.aiAction = Math.random() < 0.35 ? 'jump' : 'chase';
}

function applyAI(f, target) {
  f.facing = f.x < target.x ? 1 : -1;
  f.isCrouching = false;
  f.isBlocking = false;

  const dx = target.x - f.x;
  
  if (target.attacking && f.onGround && Math.random() < 0.4) {
    f.isBlocking = true;
    f.vx = -f.facing * f.speed * 0.5;
    return;
  }
  
  if (Math.abs(dx) < 80 && Math.random() < 0.1) {
    f.isCrouching = true;
    f.vx = 0;
  }

  switch (f.aiAction) {
    case 'chase':
      if (!f.isCrouching) f.vx = f.facing * f.speed * 0.75;
      break;
    case 'attack':
      f.vx = 0;
      if (f.attackCooldown <= 0 && !f.specialAttacking) {
        // Use special if energy full
        if (f.energy >= f.maxEnergy && f.specialCooldown <= 0 && Math.random() < 0.4) {
          triggerSpecial(f);
        } else {
          triggerAttack(f, Math.random() < 0.5 ? 'punch' : 'kick');
        }
      }
      break;
    case 'jump':
      if (f.onGround) { f.vy = f.jumpForce * 0.8; f.onGround = false; }
      f.vx = f.facing * f.speed * 0.5;
      break;
    case 'jump_back':
      if (f.onGround) { f.vy = f.jumpForce * 0.75; f.onGround = false; }
      f.vx = -f.facing * f.speed * 0.6;
      break;
    case 'retreat':
      f.vx = -f.facing * f.speed * 0.9;
      break;
    default:
      f.vx = 0;
  }
}


const ATTACK_REACH  = 140;
const ATTACK_DAMAGE = 6;
const ATTACK_FRAMES = 22;
const ATTACK_CD     = 35;

const SPECIAL_REACH   = 200;
const SPECIAL_DAMAGE  = 18;
const SPECIAL_FRAMES  = 30;
const SPECIAL_CD      = 80;
const ENERGY_PER_HIT  = 18;

function triggerAttack(f, type='punch') {
  f.attacking      = true;
  f.attackType     = type;
  if (type === 'kick') {
    f.attackTimer    = ATTACK_FRAMES + 4;
    f.attackCooldown = ATTACK_CD + 10;
  } else {
    f.attackTimer    = ATTACK_FRAMES;
    f.attackCooldown = ATTACK_CD;
  }
  f.attackHit      = false;
}

function triggerSpecial(f) {
  f.specialAttacking = true;
  f.specialTimer     = SPECIAL_FRAMES;
  f.specialCooldown  = SPECIAL_CD;
  f.specialHit       = false;
  f.energy = 0;
  playSound('special');
  triggerShake(6, 10);
  spawnParticles(f.x + f.w/2, f.y - f.h/2, '#bf5fff', 18, true);
}

function rectIntersect(r1, r2) {
  return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
}

function checkAttackHit(attacker, defender) {
  const defRect = {
    left: defender.x,
    right: defender.x + defender.w,
    top: defender.y - defender.h,
    bottom: defender.y
  };

  // Normal attacks
  if (attacker.attacking && !attacker.attackHit) {
    const isKick = attacker.attackType === 'kick';
    const baseDam = isKick ? ATTACK_DAMAGE + 4 : ATTACK_DAMAGE;
    const activeFrames = isKick ? ATTACK_FRAMES + 4 : ATTACK_FRAMES;

    if (attacker.attackTimer <= activeFrames && attacker.attackTimer > activeFrames * 0.4) {
      let hw = isKick ? 60 : 45;
      let hh = 25;
      let hy = isKick ? attacker.y - 45 : attacker.y - 70; // Kick hits mid, Punch hits high
      let hx = attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - hw;

      const attRect = { left: hx, right: hx + hw, top: hy, bottom: hy + hh };

      if (rectIntersect(attRect, defRect)) {
        attacker.attackHit = true;
        const finalDamage = Math.floor(baseDam * (1 + (attacker.comboCount * 0.1)));
        applyHit(attacker, defender, finalDamage, false);
      }
    }
  }

  // Special attack
  if (attacker.specialAttacking && !attacker.specialHit) {
    let hw = 180;
    let hh = 50;
    let hy = attacker.y - 65;
    let hx = attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - hw;

    const attRect = { left: hx, right: hx + hw, top: hy, bottom: hy + hh };

    if (rectIntersect(attRect, defRect)) {
      attacker.specialHit = true;
      const finalDamage = Math.floor(SPECIAL_DAMAGE * (1 + (attacker.comboCount * 0.1)));
      applyHit(attacker, defender, finalDamage, true);
    }
  }
}

function applyHit(attacker, defender, damage, isSuper) {
  const blocked = defender.isBlocking && defender.facing !== attacker.facing;

  if (blocked) {
    damage = Math.floor(damage * 0.2); // 80% reduction
    triggerShake(2, 3);
    playSound('hit');
    defender.vx = attacker.facing * 4;
    spawnParticles(defender.x + defender.w/2, defender.y - defender.h/2, '#ffffff', 5, false);
    triggerHitStop(2);
  } else {
    defender.hitFlash = 8;
    if (isSuper) {
      defender.whiteFlash = 6;
      triggerShake(9, 14);
      triggerHitStop(8);
      spawnParticles(defender.x + defender.w/2, defender.y - defender.h/2, '#ff5fff', 20, true);
      spawnParticles(defender.x + defender.w/2, defender.y - defender.h/2, '#ffe600', 10, true);
      playSound('hit');
    } else {
      triggerShake(3, 5);
      triggerHitStop(4);
      let hitColor = attacker.isPlayer ? '#ffaa00' : '#00ffcc';
      if (attacker.attackType === 'kick') {
        hitColor = attacker.isPlayer ? '#aa0000' : '#aa00cc';
      }
      spawnParticles(defender.x + defender.w/2, defender.y - defender.h/2, hitColor, 8, false);
      playSound('punch');
    }
    // Knockback
    const kbX = isSuper ? attacker.facing * 10 : attacker.facing * 5;
    const kbY = isSuper ? -7 : -3;
    defender.vx = kbX;
    defender.vy = kbY;

    // Blood splat at defender position
    const bx = defender.x + defender.w/2;
    const by = defender.y - defender.h * 0.6;
    if (isSuper) {
      spawnBlood(bx, by, 22);
    } else {
      spawnBlood(bx, by, 10);
    }
    
    // Combos
    attacker.comboCount++;
    attacker.comboTimer = 120; // 2 seconds to land next hit
    defender.comboCount = 0;   // Break combo on hit
    defender.comboTimer = 0;
  }

  defender.health = Math.max(0, defender.health - damage);

  // Attacker gains energy on hit
  if (!isSuper) {
    const prevFull = attacker.energy >= attacker.maxEnergy;
    attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + ENERGY_PER_HIT);
    if (!prevFull && attacker.energy >= attacker.maxEnergy) {
      playSound('energy');
    }
  }
}

