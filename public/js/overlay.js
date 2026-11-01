// OBS Overlay Client Controller
const socket = io();

const phaseLabels = {
  LOBBY: 'En Espera',
  VIEWING: 'Viendo Cartas',
  DISCUSSION: 'Debate / Preguntas',
  VOTING: 'Votación en Curso',
  RESULTS: 'Resultados Finales'
};

const phaseDotColors = {
  LOBBY: 'bg-slate-400',
  VIEWING: 'bg-amber-400 animate-pulse',
  DISCUSSION: 'bg-[#00f0ff] animate-pulse',
  VOTING: 'bg-[#ff2a5f] animate-ping',
  RESULTS: 'bg-emerald-400'
};

let currentPhase = null;

socket.on('connect', () => {
  console.log('Overlay connected to server');
});

socket.on('state_update', (state) => {
  renderOverlay(state);
});

socket.on('timer_tick', ({ timerCurrent }) => {
  updateTimerDisplay(timerCurrent);
});

socket.on('play_sound', (soundName) => {
  if (window.soundManager) {
    if (soundName === 'tick') window.soundManager.playTick();
    if (soundName === 'warning') window.soundManager.playWarning();
    if (soundName === 'card_flip') window.soundManager.playCardReveal();
    if (soundName === 'impostor_alert') window.soundManager.playImpostorAlert();
    if (soundName === 'victory') window.soundManager.playVictory();
  }
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTimerDisplay(seconds) {
  const display = document.getElementById('timer-display');
  const timerBox = document.getElementById('timer-box');
  if (!display) return;
  display.textContent = formatTime(seconds);

  if (seconds <= 15 && seconds > 0) {
    timerBox.classList.add('border-red-500', 'shadow-lg', 'shadow-red-500/30');
    display.classList.add('text-red-400', 'animate-pulse');
  } else {
    timerBox.classList.remove('border-red-500', 'shadow-lg', 'shadow-red-500/30');
    display.classList.remove('text-red-400', 'animate-pulse');
  }
}

function renderOverlay(state) {
  // Phase update
  const phaseText = document.getElementById('phase-text');
  const phaseDot = document.getElementById('phase-dot');
  const impostorBadge = document.getElementById('impostor-badge');

  if (phaseText) phaseText.textContent = phaseLabels[state.phase] || state.phase;
  if (phaseDot) phaseDot.className = `w-2 h-2 rounded-full ${phaseDotColors[state.phase] || 'bg-cyan-400'}`;
  if (impostorBadge) {
    impostorBadge.textContent = `${state.impostorCount} ${state.impostorCount > 1 ? 'IMPOSTORES' : 'IMPOSTOR'}`;
  }

  // Timer
  updateTimerDisplay(state.timerCurrent);

  // Active viewing player pill
  const actionPill = document.getElementById('current-action-pill');
  const activePlayerName = document.getElementById('current-active-player');
  if (state.phase === 'VIEWING' && state.currentViewingPlayer) {
    actionPill.classList.remove('hidden');
    actionPill.classList.add('flex');
    activePlayerName.textContent = state.currentViewingPlayer.name;
  } else {
    actionPill.classList.remove('flex');
    actionPill.classList.add('hidden');
  }

  // Render Players Left HUD
  renderPlayers(state);

  // Render Bottom-Center Secret Card for Stream Viewers
  renderSecretCard(state);

  // Render Results Modal if RESULTS phase
  renderResultsModal(state);

  // Check phase change cues
  if (currentPhase !== state.phase) {
    if (state.phase === 'RESULTS') {
      triggerConfetti();
    }
    currentPhase = state.phase;
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderPlayers(state) {
  const container = document.getElementById('players-list');
  if (!container) return;

  container.innerHTML = state.players.map((p, idx) => {
    let statusHtml = '';
    let borderClass = 'border-slate-800/80';
    let bgClass = 'bg-slate-900/85';

    if (state.phase === 'VIEWING') {
      if (idx === state.currentViewingIndex) {
        borderClass = 'border-[#00f0ff] shadow-md shadow-cyan-500/20';
        bgClass = 'bg-cyan-950/40';
        statusHtml = `<span class="text-[10px] text-[#00f0ff] font-bold animate-pulse">Viendo...</span>`;
      } else if (p.hasViewedCard) {
        statusHtml = `<span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Listo</span>`;
      } else {
        statusHtml = `<span class="text-[10px] text-slate-500">Espera</span>`;
      }
    } else if (state.phase === 'VOTING') {
      if (p.votedFor) {
        statusHtml = `<span class="text-[10px] text-purple-400 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Votó</span>`;
      } else {
        statusHtml = `<span class="text-[10px] text-amber-400 font-bold animate-pulse">Pensando</span>`;
      }
    } else if (state.phase === 'RESULTS') {
      if (p.isImpostor) {
        borderClass = 'border-[#ff2a5f] shadow-lg shadow-pink-500/30';
        bgClass = 'bg-red-950/60';
        statusHtml = `<span class="badge-cyber badge-red text-[9px]">IMPOSTOR</span>`;
      } else {
        statusHtml = `<span class="badge-cyber badge-green text-[9px]">INOCENTE</span>`;
      }
    } else {
      statusHtml = `<span class="text-[10px] text-slate-400">En mesa</span>`;
    }

    // Avatar color palette
    const colors = ['from-pink-500 to-rose-600', 'from-cyan-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-600', 'from-fuchsia-500 to-pink-600', 'from-indigo-500 to-blue-700', 'from-rose-400 to-red-600'];
    const avatarBg = colors[idx % colors.length];
    const initial = p.name ? p.name.charAt(0).toUpperCase() : (idx + 1);

    return `
      <div class="glass-panel px-3 py-1.5 flex items-center justify-between border ${borderClass} ${bgClass} rounded-xl transition-all duration-300">
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-tr ${avatarBg} flex items-center justify-center text-white font-cyber text-xs font-bold shadow-sm flex-shrink-0">
            ${initial}
          </div>
          <span class="text-xs font-semibold text-slate-200 truncate max-w-[100px]">${p.name}</span>
        </div>
        <div class="flex-shrink-0">${statusHtml}</div>
      </div>
    `;
  }).join('');
}

function renderSecretCard(state) {
  const container = document.getElementById('secret-card-container');
  if (!container) return;

  const shouldShow = state.secretCard && state.showOverlaySecret && state.phase !== 'LOBBY';

  if (shouldShow) {
    container.classList.remove('hidden');

    const img = document.getElementById('secret-char-img');
    const name = document.getElementById('secret-char-name');
    const anime = document.getElementById('secret-anime-name');
    const cat = document.getElementById('secret-category-badge');

    if (img) {
      img.src = state.secretCard.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
      img.onerror = () => {
        img.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
      };
    }
    if (name) name.textContent = state.secretCard.name;
    if (anime) anime.textContent = state.secretCard.anime;
    if (cat) cat.textContent = state.secretCard.category || 'Anime';
  } else {
    container.classList.add('hidden');
  }
}

function renderResultsModal(state) {
  const modal = document.getElementById('results-modal');
  if (!modal) return;

  if (state.phase === 'RESULTS') {
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const grid = document.getElementById('impostors-reveal-grid');
    const impostors = state.players.filter(p => p.isImpostor);
    
    if (grid) {
      grid.innerHTML = impostors.map(imp => `
        <div class="glass-panel-neon p-4 flex flex-col items-center gap-2 max-w-[180px]">
          <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-pink-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-500/50">
            <i data-lucide="skull" class="w-8 h-8"></i>
          </div>
          <span class="font-cyber font-bold text-white text-base">${imp.name}</span>
          <span class="badge-cyber badge-red text-[10px]">¡ERA EL IMPOSTOR!</span>
        </div>
      `).join('');
    }

    const resImg = document.getElementById('result-secret-img');
    const resTitle = document.getElementById('result-secret-title');
    if (state.secretCard) {
      if (resImg) resImg.src = state.secretCard.image;
      if (resTitle) resTitle.textContent = `${state.secretCard.name} (${state.secretCard.anime})`;
    }

    const title = document.getElementById('result-title');
    const sub = document.getElementById('result-subtitle');
    if (state.impostorWon === false) {
      title.textContent = '¡LOS INOCENTES GANAN!';
      title.className = 'font-cyber text-3xl md:text-4xl font-black text-emerald-400 mb-2 tracking-wide';
      sub.textContent = '¡Descubrieron a tiempo al impostor entre ellos!';
    } else {
      title.textContent = '¡EL IMPOSTOR HA GANADO!';
      title.className = 'font-cyber text-3xl md:text-4xl font-black text-[#ff2a5f] mb-2 tracking-wide';
      sub.textContent = 'El impostor logró engañar a todos con sus respuestas.';
    }
  } else {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}
