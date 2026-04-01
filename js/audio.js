// ── Web Audio SFX ─────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  try {
    const ac = getAudio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);

    if (type === 'punch') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.12);
      g.gain.setValueAtTime(0.4, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      o.start(); o.stop(ac.currentTime + 0.15);
    } else if (type === 'special') {
      // Two-tone impact
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.connect(g2); g2.connect(ac.destination);
      o.type = 'square'; o2.type = 'sawtooth';
      o.frequency.setValueAtTime(440, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.3);
      o2.frequency.setValueAtTime(220, ac.currentTime);
      o2.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.25);
      g.gain.setValueAtTime(0.35, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35);
      g2.gain.setValueAtTime(0.25, ac.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      o.start(); o.stop(ac.currentTime + 0.35);
      o2.start(); o2.stop(ac.currentTime + 0.3);
    } else if (type === 'hit') {
      o.type = 'square';
      o.frequency.setValueAtTime(120, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.08);
      g.gain.setValueAtTime(0.5, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      o.start(); o.stop(ac.currentTime + 0.1);
    } else if (type === 'win') {
      const freqs = [523, 659, 784, 1047];
      freqs.forEach((f, i) => {
        const oo = ac.createOscillator();
        const gg = ac.createGain();
        oo.connect(gg); gg.connect(ac.destination);
        oo.type = 'square';
        oo.frequency.value = f;
        gg.gain.setValueAtTime(0, ac.currentTime + i * 0.12);
        gg.gain.linearRampToValueAtTime(0.2, ac.currentTime + i * 0.12 + 0.02);
        gg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.25);
        oo.start(ac.currentTime + i * 0.12);
        oo.stop(ac.currentTime + i * 0.12 + 0.25);
      });
    } else if (type === 'lose') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.6);
      g.gain.setValueAtTime(0.3, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
      o.start(); o.stop(ac.currentTime + 0.6);
    } else if (type === 'energy') {
      o.type = 'sine';
      o.frequency.setValueAtTime(800, ac.currentTime);
      o.frequency.linearRampToValueAtTime(1200, ac.currentTime + 0.08);
      g.gain.setValueAtTime(0.15, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      o.start(); o.stop(ac.currentTime + 0.1);
    }
  } catch(e) {}
}

