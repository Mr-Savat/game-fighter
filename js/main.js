/* ═══════════════════════════════════════════════
   BRAWLBIT v2
   New: Special Attack · Energy Bar · Particles ·
        Screen Shake · Smarter AI · Round System ·
        Web Audio SFX · Avatar-on-head rendering
═══════════════════════════════════════════════ */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const GROUND = H - 70;


// ── DOM refs ──────────────────────────────────
const playerHealthBar = document.getElementById('playerHealthBar');
const enemyHealthBar = document.getElementById('enemyHealthBar');
const playerEnergyBar = document.getElementById('playerEnergyBar');
const enemyEnergyBar = document.getElementById('enemyEnergyBar');
const superReadyEl = document.getElementById('superReady');
const pScoreEl = document.getElementById('pScore');
const eScoreEl = document.getElementById('eScore');


// ── Avatar ────────────────────────────────────
let hostAvatarImg = null;
let clientAvatarImg = null;

function createDefaultAvatar() {
  const ac = document.createElement('canvas');
  ac.width = ac.height = 64;
  const ax = ac.getContext('2d');
  ax.fillStyle = '#ffcc88'; ax.fillRect(16, 4, 32, 28);
  ax.fillStyle = '#552200'; ax.fillRect(14, 4, 36, 10);
  ax.fillStyle = '#111'; ax.fillRect(22, 16, 6, 6); ax.fillRect(36, 16, 6, 6);
  ax.fillStyle = '#cc5533'; ax.fillRect(24, 26, 16, 4);
  ax.fillStyle = '#cc2222'; ax.fillRect(12, 32, 40, 24);
  ax.fillStyle = '#ffcc88'; ax.fillRect(4, 32, 8, 20); ax.fillRect(52, 32, 8, 20);
  ax.fillStyle = '#334'; ax.fillRect(14, 56, 14, 8); ax.fillRect(36, 56, 14, 8);
  
  hostAvatarImg = new Image();
  hostAvatarImg.src = ac.toDataURL();
  clientAvatarImg = new Image();
  clientAvatarImg.src = ac.toDataURL();

  document.getElementById('avatarPreview').src = hostAvatarImg.src;
}


// ── Round System ──────────────────────────────
let playerScore = 0;
let enemyScore = 0;
let currentRound = 1;
const MAX_ROUNDS = 3;


// ── Game State ────────────────────────────────
let gameRunning = false;
let animId = null;
let matchTime = 99;
let timerFrames = 0;


// ── Keys ──────────────────────────────────────
const keys = {};
let shiftJustPressed = false;
document.addEventListener('keydown', e => {
  if (!keys[e.code] && e.code === 'ShiftLeft') shiftJustPressed = true;
  keys[e.code] = true;
  // Prevent Space/arrows from scrolling or exiting fullscreen mid-game
  if (gameRunning && ['Space', 'KeyW', 'KeyA', 'KeyD', 'ShiftLeft'].includes(e.code)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });


// ── Player Input ──────────────────────────────
function handleMovement(f, inputMap = keys, isShiftPressed = shiftJustPressed) {
  if (f.isPlayer === false && !(isOnline && isHost)) return;

  // Crouching
  if (inputMap['KeyS'] && f.onGround) {
    f.isCrouching = true;
    f.vx = 0;
  } else {
    f.isCrouching = false;
  }

  // Blocking
  f.isBlocking = (!f.isCrouching && f.onGround && ((f.facing === 1 && inputMap['KeyA']) || (f.facing === -1 && inputMap['KeyD'])));

  // Walking
  if (!f.isCrouching) {
    if (inputMap['KeyA']) { f.vx = -f.speed; f.facing = -1; }
    else if (inputMap['KeyD']) { f.vx = f.speed; f.facing = 1; }
    else { f.vx = 0; }
  }

  // Jumping
  if (inputMap['KeyW'] && f.onGround && !f.isCrouching) { f.vy = f.jumpForce; f.onGround = false; }

  // Attacks
  if (f.attackCooldown <= 0 && !f.specialAttacking) {
    if (inputMap['Space']) triggerAttack(f, 'punch');
    else if (inputMap['KeyK']) triggerAttack(f, 'kick');
  }

  // Special
  if (isShiftPressed && f.energy >= f.maxEnergy && f.specialCooldown <= 0 && !f.attacking) {
    triggerSpecial(f);
  }
}


// ── HUD Update ────────────────────────────────
function updateHUD() {
  playerHealthBar.style.width = (player.health / player.maxHealth * 100) + '%';
  enemyHealthBar.style.width = (enemy.health / enemy.maxHealth * 100) + '%';
  playerEnergyBar.style.width = (player.energy / player.maxEnergy * 100) + '%';
  enemyEnergyBar.style.width = (enemy.energy / enemy.maxEnergy * 100) + '%';

  if (player.health < (player.maxHealth * 0.3)) playerHealthBar.style.background = 'linear-gradient(90deg,#800,#f00)';
  if (enemy.health < (enemy.maxHealth * 0.3)) enemyHealthBar.style.background = 'linear-gradient(90deg,#005060,#00cfff)';

  // Super ready indicator
  superReadyEl.style.display = (player.energy >= player.maxEnergy) ? 'block' : 'none';

  pScoreEl.textContent = playerScore;
  eScoreEl.textContent = enemyScore;
}


// ── Game Over ─────────────────────────────────
function checkGameOver() {
  if (player.health > 0 && enemy.health > 0 && matchTime > 0) return;

  gameRunning = false;
  let playerWon = false;
  let timeOut = false;

  if (matchTime <= 0) {
    timeOut = true;
    playerWon = player.health > enemy.health;
  } else {
    playerWon = enemy.health <= 0;
  }

  let isLocalVictory = (isOnline && !isHost) ? !playerWon : playerWon;

  // Only the host (or solo) strictly dictates the score increment
  if (!isOnline || isHost) {
    if (playerWon) playerScore++;
    else enemyScore++;
  }

  if (isLocalVictory) playSound('win');
  else playSound('lose');

  const title = document.getElementById('overlayTitle');
  const subtitle = document.getElementById('overlaySubtitle');
  const roundRes = document.getElementById('roundResult');

  pScoreEl.textContent = playerScore;
  eScoreEl.textContent = enemyScore;

  if (timeOut) title.textContent = 'TIME OUT';
  else title.textContent = playerWon ? 'K.O.' : 'K.O.';

  if (playerScore >= 2 || enemyScore >= 2) {
    if (!timeOut) title.textContent = isLocalVictory ? 'VICTORY!' : 'DEFEATED!';
    subtitle.textContent = isLocalVictory ? 'You win the match!' : (isOnline ? 'Opponent wins the match!' : 'CPU wins the match!');
    roundRes.textContent = `FINAL SCORE  ${playerScore} — ${enemyScore}`;
    title.className = isLocalVictory ? 'win' : 'lose';
    document.getElementById('restartBtn').textContent = (isOnline && !isHost) ? 'WAITING FOR HOST...' : 'NEW MATCH';
  } else {
    if (!timeOut) title.textContent = isLocalVictory ? 'ROUND WIN!' : 'ROUND LOST!';
    subtitle.textContent = `Round ${currentRound} complete · Play again`;
    roundRes.textContent = `Score: ${playerScore} — ${enemyScore}`;
    title.className = isLocalVictory ? 'win' : 'lose';
    document.getElementById('restartBtn').textContent = (isOnline && !isHost) ? 'WAITING FOR HOST...' : `ROUND ${currentRound + 1}`;
    
    if (!isOnline || isHost) currentRound++;
  }

  document.getElementById('overlay').classList.add('active');

  // Broadcast the final authoritative score to the client instantly
  if (isOnline && isHost) {
    sendNetworkState();
  }
}


// ── Game Loop ─────────────────────────────────
function gameLoop() {
  if (!gameRunning) return;

  if (hitStopFrames > 0) {
    hitStopFrames--;
    animId = requestAnimationFrame(gameLoop);
    return;
  }

  if (matchTime > 0) {
    timerFrames++;
    if (timerFrames >= 60) {
      matchTime--;
      document.getElementById('roundTimer').textContent = matchTime;
      timerFrames = 0;
    }
  }

  if (isOnline && !isHost) {
    // Client strictly sends inputs to the host, physics are skipped
    sendNetworkInput(keys, shiftJustPressed);
    shiftJustPressed = false;
  } else {
    // Host/Solo handles local inputs
    handleMovement(player, keys, shiftJustPressed);
    shiftJustPressed = false;

    if (isOnline && isHost) {
      handleMovement(enemy, remoteKeys, remoteShiftJustPressed);
      remoteShiftJustPressed = false;
    } else {
      handleAI(enemy, player);
      applyAI(enemy, player);
    }

    applyPhysics(player);
    applyPhysics(enemy);

    checkAttackHit(player, enemy);
    checkAttackHit(enemy, player);

    updateParticles();

    if (isOnline && isHost) {
      sendNetworkState();
    }
  }

  // Screen shake
  let ox = 0, oy = 0;
  if (shakeFrames > 0) {
    ox = (Math.random() - 0.5) * shakeIntensity;
    oy = (Math.random() - 0.5) * shakeIntensity;
    shakeFrames--;
  }

  ctx.save();
  ctx.translate(ox, oy);

  ctx.clearRect(-20, -20, W + 40, H + 40);
  drawBackground();
  drawParticles();
  drawFighter(player);
  drawFighter(enemy);
  drawAnnounce();

  ctx.restore();

  updateHUD();
  checkGameOver();

  animId = requestAnimationFrame(gameLoop);
}


// ── Start / Restart ───────────────────────────
function startGame() {
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameWrapper').style.display = 'flex';
  document.getElementById('overlay').classList.remove('active');

  particles = [];
  shakeFrames = 0;

  initFighters();
  playerHealthBar.style.background = 'linear-gradient(90deg,#ff2d2d,#ff6b35)';
  enemyHealthBar.style.background = 'linear-gradient(90deg,#00cfff,#0080ff)';

  matchTime = 99;
  timerFrames = 0;
  document.getElementById('roundTimer').textContent = matchTime;

  showAnnounce(`ROUND ${currentRound}`, 90);

  gameRunning = true;
  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function fullReset() {
  playerScore = 0;
  enemyScore = 0;
  currentRound = 1;
}


// ── Upload ────────────────────────────────────
document.getElementById('avatarInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Scale down image to 64x64 to prevent WebRTC payload limit crashes
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 64;
      tmpCanvas.height = 64;
      const tCtx = tmpCanvas.getContext('2d');
      tCtx.drawImage(img, 0, 0, 64, 64);
      
      const scaledDataUrl = tmpCanvas.toDataURL('image/jpeg', 0.8);
      
      const compressedImg = new Image();
      compressedImg.onload = () => {
        if (isOnline && !isHost) {
          clientAvatarImg = compressedImg;
        } else {
          hostAvatarImg = compressedImg;
        }
        document.getElementById('avatarPreview').src = scaledDataUrl;
      };
      compressedImg.src = scaledDataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});


// ── Buttons ───────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  fullReset();
  startGame();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  if (isOnline && !isHost) return; // Client waits for host to automatically sync next round
  
  // If match over, full reset
  if (playerScore >= 2 || enemyScore >= 2) fullReset();
  startGame();
});


// ── Fullscreen ────────────────────────────────
function toggleFS() {
  const wrapper = document.getElementById('gameWrapper');
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen && wrapper.requestFullscreen();
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('fsBtn');
  if (document.fullscreenElement) {
    btn.textContent = '✕ EXIT FULLSCREEN';
    scaleCanvas();
  } else {
    btn.textContent = '⛶ FULLSCREEN';
    resetCanvas();
  }
});

function scaleCanvas() {
  const sw = window.innerWidth || window.screen.width;
  const sh = window.innerHeight || window.screen.height;
  const scale = Math.min(sw / 820, (sh - 60) / 500);
  canvas.style.width = (820 * scale) + 'px';
  canvas.style.height = (430 * scale) + 'px';
  const hud = document.getElementById('hud');
  hud.style.width = '820px';
  hud.style.transform = `scale(${scale})`;
  hud.style.transformOrigin = 'top center';
  hud.style.marginBottom = `-${Math.round(hud.offsetHeight * (1 - scale))}px`;
}

function resetCanvas() {
  canvas.style.width = '';
  canvas.style.height = '';
  const hud = document.getElementById('hud');
  hud.style.width = '820px';
  hud.style.transform = '';
}


// ── Init ──────────────────────────────────────
createDefaultAvatar();
buildCityCanvas();

