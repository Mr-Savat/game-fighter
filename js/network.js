let peer = null;
let conn = null;
let isOnline = false;
let isHost = false;

// Inputs arriving from Client
let remoteKeys = {};
let remoteShiftJustPressed = false;

// FFA Tracking
let ffaConnections = []; // Array of client objects { conn, id, keys, shiftJustPressed }

function updateLobbyUI() {
    const container = document.getElementById('lobbyProfiles');
    if (!container || !isFFA || gameRunning) return;
    
    container.innerHTML = '';
    const createThumb = (name, src, glowCol) => {
        const d = document.createElement('div');
        const imgTag = src ? `<img src="${src}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;object-position:center;">` : `<div style="width:30px;height:30px;background:#333;border-radius:4px;"></div>`;
        d.innerHTML = `${imgTag}<span style="font-size:11px;color:#fff;font-weight:bold;max-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>`;
        d.style = `display:flex; align-items:center; gap:8px; background:#111; padding:6px 12px 6px 6px; border-radius:30px; border:1px solid ${glowCol};`;
        return d;
    };

    if (isHost) {
        const hName = document.getElementById('playerNameInput').value.trim() || 'HOST';
        const hImgSrc = (typeof hostAvatarImg !== 'undefined' && hostAvatarImg && hostAvatarImg.complete) ? hostAvatarImg.src : '';
        container.appendChild(createThumb(hName, hImgSrc, '#bf5fff'));
        
        ffaConnections.forEach((c, i) => {
           if (!c.conn || !c.conn.open) return;
           const cName = c.name || `P${i+2}`;
           const cImgSrc = (c.avatar && c.avatar.complete) ? c.avatar.src : '';
           container.appendChild(createThumb(cName, cImgSrc, '#444'));
        });
    } else {
        const avatars = window.ffaAvatarSrcMap || {};
        const names = window.ffaNameMap || {};
        
        let maxIdx = -1;
        for (let k in avatars) if (parseInt(k) > maxIdx) maxIdx = parseInt(k);
        for (let k in names) if (parseInt(k) > maxIdx) maxIdx = parseInt(k);
        
        if (maxIdx === -1) {
            // Self only
            const hName = document.getElementById('playerNameInput').value.trim() || 'YOU';
            const hImgSrc = (typeof clientAvatarImg !== 'undefined' && clientAvatarImg && clientAvatarImg.complete) ? clientAvatarImg.src : '';
            container.appendChild(createThumb(hName, hImgSrc, '#444'));
            return;
        }
        
        for (let i = 0; i <= maxIdx; i++) {
            if (!avatars[i] && !names[i] && i !== 0) continue;
            let cName = names[i] || (i === 0 ? 'HOST' : `P${i+1}`);
            let glow = i === 0 ? '#bf5fff' : '#444';
            container.appendChild(createThumb(cName, avatars[i], glow));
        }
    }
}

function setupNetworkUI() {
  document.getElementById('hostBtn').addEventListener('click', () => {
    isFFA = false;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('hostFfaBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    initHost();
  });

  document.getElementById('hostFfaBtn').addEventListener('click', () => {
    isFFA = true;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('hostFfaBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    initHostFFA();
  });

  document.getElementById('startOnlineBtn').addEventListener('click', () => {
    // Send Start Signal and Host Avatar
    const avatarDataUrl = hostAvatarImg && hostAvatarImg.complete ? hostAvatarImg.src : null;
    
    // Broadcast to 1v1 or all FFA clients
    if (isFFA) {
      const myName = document.getElementById('playerNameInput').value.trim();
      if (fighters.length > 0) {
          fighters[0].customAvatar = hostAvatarImg;
          if (myName) fighters[0].name = myName;
      }
      
      let allAvatars = { 0: avatarDataUrl };
      let allNames = { 0: myName };
      
      for (let i = 0; i < ffaConnections.length; i++) {
        const client = ffaConnections[i];
        if (client.avatar && client.avatar.complete) {
          allAvatars[i + 1] = client.avatar.src;
          if (fighters[i + 1]) fighters[i + 1].customAvatar = client.avatar;
        }
        if (client.name) {
          allNames[i + 1] = client.name;
          if (fighters[i + 1]) fighters[i + 1].name = client.name;
        }
      }
      for (const client of ffaConnections) {
        if (client.conn && client.conn.open) client.conn.send({ type: 'startFFA', allAvatars, allNames });
      }
    } else {
      const myName = document.getElementById('playerNameInput').value.trim();
      if (conn && conn.open) conn.send({ type: 'start', avatar: avatarDataUrl, name: myName });
    }

    document.getElementById('startScreen').style.display = 'none';
    startGame();
  });

  // Check URL if we are joining 1v1
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get('join');
  if (joinId) {
    isFFA = false;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('hostFfaBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    document.getElementById('onlineStatus').textContent = 'Joining 1v1 Match...';
    document.getElementById('inviteLink').style.display = 'none';
    document.getElementById('linkHint').style.display = 'none';
    
    document.getElementById('playerNameDisplay').textContent = 'OPPONENT';
    document.getElementById('enemyNameDisplay').textContent = 'YOU';

    initClient(joinId);
  }

  // Check URL if we are joining FFA
  const joinFfaId = urlParams.get('joinFFA');
  if (joinFfaId) {
    isFFA = true;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('hostFfaBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    document.getElementById('onlineStatus').textContent = 'Joining Free-For-All...';
    document.getElementById('inviteLink').style.display = 'none';
    document.getElementById('linkHint').style.display = 'none';
    
    // FFA hides the names anyway, but we set it just in case
    document.getElementById('playerNameDisplay').textContent = 'BRAWL';
    document.getElementById('enemyNameDisplay').textContent = 'BRAWL';

    initClientFFA(joinFfaId);
  }
}

function initHost() {
  peer = new Peer(); // auto-generate ID
  peer.on('open', id => {
    isOnline = true;
    isHost = true;

    // Set Names for Host View
    document.getElementById('playerNameDisplay').textContent = 'YOU';
    document.getElementById('enemyNameDisplay').textContent = 'OPPONENT';

    const link = window.location.origin + window.location.pathname + '?join=' + id;
    document.getElementById('inviteLink').value = link;
    document.getElementById('onlineStatus').textContent = 'Waiting for Player 2...';
  });

  peer.on('connection', connection => {
    conn = connection;
    
    if (!gameRunning) {
      document.getElementById('onlineStatus').textContent = '[P2 JOINED] Setup Avatar, then Start!';
      document.getElementById('inviteLink').style.display = 'none';
      document.getElementById('linkHint').style.display = 'none';
      document.getElementById('startOnlineBtn').style.display = 'block';
    }

    conn.on('open', () => {
      // Clear disconnect timer if opponent reconnected
      if (window.disconnectTimer) {
        clearTimeout(window.disconnectTimer);
        window.disconnectTimer = null;
      }
      window.lastClientPing = Date.now(); // reset heartbeat tracking

      // If the match is already running (e.g. client reconnected), send start to skip lobby
      if (gameRunning) {
        const avatarDataUrl = hostAvatarImg && hostAvatarImg.complete ? hostAvatarImg.src : null;
        conn.send({ type: 'start', avatar: avatarDataUrl });
      }
    });

    conn.on('data', data => {
      window.lastClientPing = Date.now(); // Record heartbeat!
      
      // Receive inputs from client
      if (data.type === 'input') {
        remoteKeys = data.keys;
        if (data.shift) remoteShiftJustPressed = true;
      }

      // Receive Client Avatar Response
      if (data.type === 'avatar') {
        if (data.avatar) {
          clientAvatarImg = new Image();
          clientAvatarImg.src = data.avatar;
        }
        if (data.name && typeof enemy !== 'undefined') enemy.name = data.name;
        
        const myName = document.getElementById('playerNameInput').value.trim();
        if (myName && typeof player !== 'undefined') player.name = myName;
      }
    });
    
    // Heartbeat for instant and visual disconnect detection
    if (window.clientPingInterval) clearInterval(window.clientPingInterval);
    window.lastClientPing = Date.now();
    
    window.clientPingInterval = setInterval(() => {
      if (!gameRunning || isFFA || typeof enemy === 'undefined') return;
      
      const timeSincePing = Date.now() - window.lastClientPing;
      
      // If 2+ seconds pass without input, they are hanging/disconnected!
      if (timeSincePing > 2000) {
        remoteKeys = {};
        remoteShiftJustPressed = false;
        
        const GRACE_PERIOD_MS = 9000; // Total 9s (2s dead + 7s warning)
        const timeLeft = Math.ceil((GRACE_PERIOD_MS - timeSincePing) / 1000);
        
        if (timeLeft <= 0) {
            playerScore = 2; // Force full match victory
            window.opponentDropped = true; // Mark as disconnect-win
            enemy.health = 0; // Trigger Auto-win
            clearInterval(window.clientPingInterval);
        } else {
            if (typeof showAnnounce === 'function') {
               showAnnounce(`OPPONENT DROPPED! WAITING: ${timeLeft}`, 60);
            }
        }
      }
    }, 1000);

    conn.on('close', () => {
      remoteKeys = {};
      remoteShiftJustPressed = false;
      // Heartbeat timer handles the 7-second grace period visually!
    });
  });
}

function initClient(hostId) {
  peer = new Peer();
  peer.on('open', () => {
    isOnline = true;
    isHost = false;

    conn = peer.connect(hostId);

    conn.on('open', () => {
      document.getElementById('onlineStatus').textContent = '[CONNECTED] Setup Avatar. Waiting for Host...';
    });

    conn.on('data', data => {
      if (data.type === 'start') {
        // Send our local avatar back to Host
        const avatarDataUrl = clientAvatarImg && clientAvatarImg.complete ? clientAvatarImg.src : null;
        const myName = document.getElementById('playerNameInput').value.trim();
        if (conn && conn.open) conn.send({ type: 'avatar', avatar: avatarDataUrl, name: myName });

        // Receive Host avatar
        if (data.avatar) {
          hostAvatarImg = new Image();
          hostAvatarImg.src = data.avatar;
        }

        document.getElementById('startScreen').style.display = 'none';
        startGame(); // Initialize dummy states
        
        if (data.name && typeof enemy !== 'undefined') enemy.name = data.name;
        if (myName && typeof player !== 'undefined') player.name = myName;
      }

      // Receive full simulation state from Host
      if (data.type === 'state') {
        Object.assign(player, data.player);
        Object.assign(enemy, data.enemy);
        matchTime = data.time;
        playerScore = data.pScore;
        enemyScore = data.eScore;
        currentRound = data.round;

        // Force the Client's Game Over screen to perfectly match the Host's authoritative score
        if (!isHost && !gameRunning) {
          document.getElementById('pScore').textContent = playerScore;
          document.getElementById('eScore').textContent = enemyScore;
          if (playerScore < 2 && enemyScore < 2) {
            document.getElementById('roundResult').textContent = `Score: ${playerScore} — ${enemyScore}`;
          } else {
            document.getElementById('roundResult').textContent = `FINAL SCORE  ${playerScore} — ${enemyScore}`;
          }
        }

        // If Host restarted the match/round automatically
        if (data.running && !gameRunning) {
          startGame();
        }

        if (data.particles) particles = data.particles;
      }
    });

    conn.on('close', () => {
      alert("Host disconnected.");
      location.reload();
    });
  });

  peer.on('error', (err) => {
    alert("Connection Error: " + err.type + "\nMake sure you copied the exact, newest link!");
    window.location.href = window.location.origin + window.location.pathname;
  });
}

function sendNetworkInput(currentKeys, shiftJust) {
  if (conn && conn.open && !isHost) {
    conn.send({ type: 'input', keys: currentKeys, shift: shiftJust });
  }
}

function sendNetworkState() {
  if (conn && conn.open && isHost) {
    conn.send({
      type: 'state',
      player: player,
      enemy: enemy,
      time: matchTime,
      pScore: playerScore,
      eScore: enemyScore,
      round: currentRound,
      running: gameRunning,
      particles: particles
    });
  }
}

// ============================================
// ======== FREE FOR ALL MODE (FFA) ===========
// ============================================

function initHostFFA() {
  peer = new Peer();
  peer.on('open', id => {
    isOnline = true;
    isHost = true;
    
    document.getElementById('playerNameDisplay').textContent = 'YOU (HOST)';
    document.getElementById('enemyNameDisplay').textContent = 'BRAWL';
    
    // Make sure Host exists mechanically BEFORE clients join!
    // fighter.createFighter doesn't have W or GROUND if W isn't defined? It's fine if they are globals.
    if (fighters.length === 0) {
       fighters.push(createFighter({ x: 200, y: GROUND, color: '#ff3a3a', isPlayer: true, facing: 1 }));
    }

    const link = window.location.origin + window.location.pathname + '?joinFFA=' + id;
    document.getElementById('inviteLink').value = link;
    document.getElementById('onlineStatus').textContent = 'Waiting for Players...';
  });

  peer.on('connection', connection => {
    let slotIdx = -1;
    if (gameRunning) {
      slotIdx = ffaConnections.findIndex(c => !c.conn || !c.conn.open);
      if (slotIdx === -1) {
        connection.on('open', () => {
          connection.send({ type: 'rejectedFFA' });
          setTimeout(() => connection.close(), 500);
        });
        return;
      }
    }

    if (!gameRunning) {
      document.getElementById('onlineStatus').textContent = `[${ffaConnections.length + 1} JOINED] Setup Avatar, then Start!`;
      document.getElementById('startOnlineBtn').style.display = 'block';
      document.getElementById('inviteLink').style.display = 'none';
      document.getElementById('linkHint').style.display = 'none';
      updateLobbyUI();
    }

    let client;
    if (slotIdx !== -1) {
      client = ffaConnections[slotIdx];
      client.conn = connection;
      client.id = connection.peer;
    } else {
      client = { conn: connection, id: connection.peer, keys: {}, shiftJustPressed: false, avatar: null };
      ffaConnections.push(client);
      
      // Assign a distinct neon color sequentially
      const FFA_COLORS = ['#ff3a3a', '#00cfff', '#00ff33', '#ffea00', '#b200ff', '#ff8800', '#ff00aa', '#ffffff'];
      const pColor = FFA_COLORS[fighters.length % FFA_COLORS.length];
      
      // Add dummy fighter so it exists when we start
      fighters.push(createFighter({ x: 200 + Math.random() * 400, y: GROUND, color: pColor, isPlayer: false, facing: -1 }));
    }

    connection.on('open', () => {
       if (gameRunning && slotIdx !== -1) {
          let allAvatars = { 0: (typeof hostAvatarImg !== 'undefined' && hostAvatarImg && hostAvatarImg.complete) ? hostAvatarImg.src : null };
          let allNames = { 0: (fighters.length > 0 && fighters[0].name) ? fighters[0].name : document.getElementById('playerNameInput').value.trim() };
          for (let i = 0; i < ffaConnections.length; i++) {
             if (ffaConnections[i].avatar) allAvatars[i + 1] = ffaConnections[i].avatar.src;
             if (ffaConnections[i].name) allNames[i + 1] = ffaConnections[i].name;
          }
          connection.send({ type: 'startFFA', allAvatars, allNames });
       }
    });

    connection.on('data', data => {
      if (data.type === 'input') {
        client.keys = data.keys;
        if (data.shift) client.shiftJustPressed = true;
      }
      if (data.type === 'avatar') {
        let fIndex = ffaConnections.indexOf(client) + 1;
        if (data.avatar) {
          client.avatar = new Image();
          client.avatar.src = data.avatar;
          if (fighters[fIndex]) fighters[fIndex].customAvatar = client.avatar;
        }
        if (data.name) {
            client.name = data.name;
            if (fighters[fIndex]) fighters[fIndex].name = data.name;
        }
        
        // Ensure all connected clients instantly receive the updated global avatar mapping!
        let allAvatars = { 0: (typeof hostAvatarImg !== 'undefined' && hostAvatarImg && hostAvatarImg.complete) ? hostAvatarImg.src : null };
        let allNames = { 0: (fighters.length > 0 && fighters[0].name) ? fighters[0].name : document.getElementById('playerNameInput').value.trim() };
        for (let i = 0; i < ffaConnections.length; i++) {
           if (ffaConnections[i].avatar) allAvatars[i + 1] = ffaConnections[i].avatar.src;
           if (ffaConnections[i].name) allNames[i + 1] = ffaConnections[i].name;
        }
        updateLobbyUI();
        for (const other of ffaConnections) {
           if (other.conn && other.conn.open) other.conn.send({ type: 'updateAvatarsFFA', allAvatars, allNames });
        }
      }
    });

    connection.on('close', () => {
       if (gameRunning) {
          client.conn = null;
          client.keys = {};
       } else {
           const idx = ffaConnections.indexOf(client);
           if (idx > -1) {
              ffaConnections.splice(idx, 1);
              fighters.splice(idx + 1, 1); // host is 0
           }
           updateLobbyUI();
       }
    });
  });
}

function initClientFFA(hostId) {
  peer = new Peer();
  peer.on('open', () => {
    isOnline = true;
    isHost = false;
    
    conn = peer.connect(hostId);
    
    conn.on('open', () => {
      document.getElementById('onlineStatus').textContent = '[CONNECTED] Setup Avatar. Waiting for Host...';
      const avatarDataUrl = (window.customAvatarUploaded && clientAvatarImg && clientAvatarImg.complete) ? clientAvatarImg.src : null;
      const myName = document.getElementById('playerNameInput').value.trim() || null;
      if (avatarDataUrl || myName) {
         conn.send({ type: 'avatar', avatar: avatarDataUrl, name: myName });
      }
    });

    conn.on('data', data => {
      if (data.type === 'rejectedFFA') {
        window.isRejected = true;
        alert("The FFA match is already in progress! You cannot join mid-game.");
        window.location.href = window.location.origin + window.location.pathname;
        return;
      }

      if (data.type === 'startFFA') {
        const avatarDataUrl = (window.customAvatarUploaded && clientAvatarImg && clientAvatarImg.complete) ? clientAvatarImg.src : null;
        const myName = document.getElementById('playerNameInput').value.trim() || null;
        if (avatarDataUrl || myName) {
            conn.send({ type: 'avatar', avatar: avatarDataUrl, name: myName });
        }
        
        document.getElementById('startScreen').style.display = 'none';
        
        // Cache initial avatar dictionary
        window.ffaAvatarSrcMap = data.allAvatars || window.ffaAvatarSrcMap || {};
        window.ffaNameMap = data.allNames || window.ffaNameMap || {};
        
        startGame();
      }

      if (data.type === 'updateAvatarsFFA') {
        window.ffaAvatarSrcMap = data.allAvatars;
        window.ffaNameMap = data.allNames;
        updateLobbyUI();
      }

      if (data.type === 'stateFFA') {
        // Sync fighters array size
        while (fighters.length < data.fighters.length) {
            fighters.push(createFighter({ x: 0, y: GROUND, color: '#fff', isPlayer: false, facing: 1 }));
        }
        while (fighters.length > data.fighters.length) {
            fighters.pop();
        }

        // Apply state
        for (let i = 0; i < data.fighters.length; i++) {
            Object.assign(fighters[i], data.fighters[i]);
            fighters[i].isClientMe = (i === data.yourIndex);
            
            // Map avatars dynamically
            if (window.ffaAvatarSrcMap && window.ffaAvatarSrcMap[i]) {
                if (!fighters[i].customAvatar || fighters[i].customAvatar.src !== window.ffaAvatarSrcMap[i]) {
                    const img = new Image();
                    img.src = window.ffaAvatarSrcMap[i];
                    fighters[i].customAvatar = img;
                }
            }
            if (window.ffaNameMap && window.ffaNameMap[i]) {
                fighters[i].name = window.ffaNameMap[i];
            }
        }
        
        matchTime = data.time;
        if (data.particles) particles = data.particles;

        // Automatically start loop if Host restarted match
        if (data.running && !gameRunning) startGame();
      }
    });

    conn.on('close', () => {
      if (window.isRejected) return;
      alert("Host disconnected from the FFA server.");
      location.reload();
    });
  });
  
  peer.on('error', (err) => {
    alert("Connection Error: " + err.type + "\nMake sure you copied the exact, newest link!");
    window.location.href = window.location.origin + window.location.pathname;
  });
}

function sendNetworkInputFFA(currentKeys, shiftJust) {
  if (conn && conn.open && !isHost) {
    conn.send({ type: 'input', keys: currentKeys, shift: shiftJust });
  }
}

function sendNetworkStateFFA() {
  if (isHost) {
    let stateFighters = fighters.map(f => {
       // deep copy subset over to minimize bandwidth
       return {
          x: f.x, y: f.y, w: f.w, h: f.h, vx: f.vx, vy: f.vy, speed: f.speed,
          health: f.health, maxHealth: f.maxHealth, energy: f.energy, maxEnergy: f.maxEnergy,
          comboCount: f.comboCount, comboTimer: f.comboTimer, isPlayer: f.isPlayer,
          facing: f.facing, color: f.color, isCrouching: f.isCrouching, isBlocking: f.isBlocking,
          attackType: f.attackType, attacking: f.attacking, attackTimer: f.attackTimer,
          specialAttacking: f.specialAttacking, specialTimer: f.specialTimer, whiteFlash: f.whiteFlash, hitFlash: f.hitFlash
       };
    });

    const packet = {
      type: 'stateFFA',
      fighters: stateFighters,
      time: matchTime,
      running: gameRunning,
      particles: particles,
      hostAvatar: hostAvatarImg && hostAvatarImg.complete ? hostAvatarImg.src : null
    };

    for (let i = 0; i < ffaConnections.length; i++) {
      let client = ffaConnections[i];
      if (client.conn && client.conn.open) {
        packet.yourIndex = i + 1; // 0 is host
        client.conn.send(packet);
      }
    }
  }
}

// Ensure network initializes on load
window.addEventListener('DOMContentLoaded', setupNetworkUI);
