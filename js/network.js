let peer = null;
let conn = null;
let isOnline = false;
let isHost = false;

// Inputs arriving from Client
let remoteKeys = {};
let remoteShiftJustPressed = false;

function setupNetworkUI() {
  document.getElementById('hostBtn').addEventListener('click', () => {
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    initHost();
  });

  // Check URL if we are joining
  const urlParams = new URLSearchParams(window.location.search);
  const joinId = urlParams.get('join');
  if (joinId) {
    // Auto-join
    document.querySelector('.avatar-panel').style.display = 'none';
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('hostBtn').style.display = 'none';
    document.getElementById('onlinePanel').style.display = 'flex';
    document.getElementById('onlineStatus').textContent = 'Joining Match...';
    document.getElementById('inviteLink').value = 'Connecting to ' + joinId;
    initClient(joinId);
  }
}

function initHost() {
  peer = new Peer(); // auto-generate ID
  peer.on('open', id => {
    isOnline = true;
    isHost = true;
    const link = window.location.origin + window.location.pathname + '?join=' + id;
    document.getElementById('inviteLink').value = link;
    document.getElementById('onlineStatus').textContent = 'Waiting for Player 2...';
  });

  peer.on('connection', connection => {
    conn = connection;
    document.getElementById('onlineStatus').textContent = 'Player Joined! Starting...';
    
    conn.on('data', data => {
      // Receive inputs from client
      if (data.type === 'input') {
        remoteKeys = data.keys;
        if (data.shift) remoteShiftJustPressed = true;
      }
    });

    setTimeout(() => {
      document.getElementById('startScreen').style.display = 'none';
      startGame(); // Host orchestrates match
    }, 1000);
  });
}

function initClient(hostId) {
  peer = new Peer();
  peer.on('open', () => {
    isOnline = true;
    isHost = false;
    
    conn = peer.connect(hostId);
    
    conn.on('open', () => {
      document.getElementById('onlineStatus').textContent = 'Connected! Get Ready...';
      
      setTimeout(() => {
        document.getElementById('startScreen').style.display = 'none';
        startGame(); // Initialize dummy states
      }, 1000);
    });

    conn.on('data', data => {
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

// Ensure network initializes on load
window.addEventListener('DOMContentLoaded', setupNetworkUI);
