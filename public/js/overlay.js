// OBS Overlay Client Controller
const socket = io();

const phaseLabels = {
  LOBBY: 'En Espera',
  VIEWING: 'Viendo Cartas',
  PLAYING: 'En Debate',
  ACCUSING: 'Eligiendo Impostor',
  ROUND_RESULT: 'Resultado de Acusación',
  GAME_OVER: 'Fin de la Partida'
};

const phaseDotColors = {
  LOBBY: 'bg-slate-400',
  VIEWING: 'bg-amber-400 animate-pulse',
  PLAYING: 'bg-[#00f0ff] animate-pulse',
  ACCUSING: 'bg-[#ff2a5f] animate-ping',
  ROUND_RESULT: 'bg-purple-400',
  GAME_OVER: 'bg-emerald-400'
};

let currentPhase = null;

socket.on('connect', () => {
  console.log('Overlay connected to server');
});

socket.on('state_update', (state) => {
  renderOverlay(state);
});

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

  // Active viewing player pill (during pass the phone)
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

  // Starting Player Box (Who starts speaking & round)
  const starterBox = document.getElementById('starting-player-box');
  const starterName = document.getElementById('overlay-starting-player');
  const roundBadge = document.getElementById('overlay-round-badge');

  if (state.startingPlayer && (state.phase === 'PLAYING' || state.phase === 'ACCUSING' || state.phase === 'ROUND_RESULT')) {
    starterBox.classList.remove('hidden');
    starterBox.classList.add('flex');
    starterName.textContent = state.startingPlayer.name;
    roundBadge.textContent = `RONDA ${state.round}`;
  } else {
    starterBox.classList.remove('flex');
    starterBox.classList.add('hidden');
  }

  // Render Players Left HUD
  renderPlayers(state);

  // Render Bottom-Center Secret Card for Stream Viewers
  renderSecretCard(state);

  // Render Accusation popup or Game Over modal
  renderPopups(state);

  if (currentPhase !== state.phase) {
    if (state.phase === 'GAME_OVER' && state.winner === 'INNOCENTS') {
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
    let textStyle = 'text-slate-200';

    if (p.isEliminated) {
      borderClass = 'border-red-900/40 opacity-40';
      bgClass = 'bg-black/60';
      textStyle = 'line-through text-slate-500';
      statusHtml = p.eliminatedAs === 'IMPOSTOR'
        ? `<span class="badge-cyber badge-red text-[8px]">Impostor 💀</span>`
        : `<span class="text-[10px] text-slate-500">Inocente ❌</span>`;
    } else if (state.phase === 'VIEWING') {
      if (idx === state.currentViewingIndex) {
        borderClass = 'border-[#00f0ff] shadow-md shadow-cyan-500/20';
        bgClass = 'bg-cyan-950/40';
        statusHtml = `<span class="text-[10px] text-[#00f0ff] font-bold animate-pulse">Viendo...</span>`;
      } else if (p.hasViewedCard) {
        statusHtml = `<span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Listo</span>`;
      } else {
        statusHtml = `<span class="text-[10px] text-slate-500">Espera</span>`;
      }
    } else if (state.startingPlayer && p.id === state.startingPlayer.id && (state.phase === 'PLAYING' || state.phase === 'ACCUSING')) {
      borderClass = 'border-cyan-400 shadow-lg shadow-cyan-500/30';
      bgClass = 'bg-cyan-950/60';
      statusHtml = `<span class="badge-cyber badge-cyan text-[9px]"><i data-lucide="mic" class="w-2.5 h-2.5"></i> Empieza</span>`;
    } else if (state.phase === 'GAME_OVER') {
      if (p.isImpostor) {
        borderClass = 'border-[#ff2a5f] shadow-lg shadow-pink-500/30';
        bgClass = 'bg-red-950/60';
        statusHtml = `<span class="badge-cyber badge-red text-[9px]">IMPOSTOR</span>`;
      } else {
        statusHtml = `<span class="badge-cyber badge-green text-[9px]">INOCENTE</span>`;
      }
    } else {
      statusHtml = `<span class="text-[10px] text-slate-400">En juego</span>`;
    }

    const colors = ['from-pink-500 to-rose-600', 'from-cyan-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-600', 'from-fuchsia-500 to-pink-600', 'from-indigo-500 to-blue-700', 'from-rose-400 to-red-600'];
    const avatarBg = colors[idx % colors.length];
    const initial = p.name ? p.name.charAt(0).toUpperCase() : (idx + 1);

    return `
      <div class="glass-panel px-3 py-1.5 flex items-center justify-between border ${borderClass} ${bgClass} rounded-xl transition-all duration-300">
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-tr ${avatarBg} flex items-center justify-center text-white font-cyber text-xs font-bold shadow-sm flex-shrink-0">
            ${initial}
          </div>
          <span class="text-xs font-semibold ${textStyle} truncate max-w-[100px]">${p.name}</span>
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

function renderPopups(state) {
  const accModal = document.getElementById('accusation-popup');
  const gameoverModal = document.getElementById('gameover-modal');

  // ROUND ACCUSATION RESULT POPUP
  if (state.phase === 'ROUND_RESULT' && state.lastAccusation && !state.lastAccusation.gameOver) {
    accModal.classList.remove('hidden');
    accModal.classList.add('flex');

    const targetName = document.getElementById('acc-target-name');
    const verdict = document.getElementById('acc-verdict');
    const detail = document.getElementById('acc-detail');
    const nextStarter = document.getElementById('acc-next-starter');
    const nextStarterName = document.getElementById('acc-next-starter-name');

    targetName.textContent = state.lastAccusation.accusedName;

    if (state.lastAccusation.isImpostor) {
      verdict.className = 'text-lg font-bold my-4 py-2 px-4 rounded-xl bg-red-950/80 border border-red-500 text-red-300';
      verdict.textContent = '¡ERA EL IMPOSTOR! 💀';
      detail.textContent = '¡Fue descubierto! Pero aún queda otro impostor en juego.';
    } else {
      verdict.className = 'text-lg font-bold my-4 py-2 px-4 rounded-xl bg-slate-900 border border-emerald-500 text-emerald-300';
      verdict.textContent = 'NO ERA EL IMPOSTOR (Era Inocente 🟢)';
      detail.textContent = 'Fue eliminado injustamente y queda fuera de la partida.';
    }

    if (state.lastAccusation.nextStartingPlayer) {
      nextStarter.classList.remove('hidden');
      nextStarterName.textContent = state.lastAccusation.nextStartingPlayer.name;
    } else {
      nextStarter.classList.add('hidden');
    }
  } else {
    accModal.classList.remove('flex');
    accModal.classList.add('hidden');
  }

  // GAME OVER POPUP
  if (state.phase === 'GAME_OVER') {
    gameoverModal.classList.remove('hidden');
    gameoverModal.classList.add('flex');

    const title = document.getElementById('gameover-title');
    const sub = document.getElementById('gameover-subtitle');
    const resImg = document.getElementById('gameover-secret-img');
    const resTitle = document.getElementById('gameover-secret-title');

    if (state.winner === 'INNOCENTS') {
      title.textContent = '¡LOS INOCENTES HAN GANADO! 🏆';
      title.className = 'font-cyber text-3xl md:text-4xl font-black text-emerald-400 mb-2 tracking-wide';
      sub.textContent = '¡Todos los impostores han sido descubiertos!';
    } else {
      title.textContent = '¡LOS IMPOSTORES HAN GANADO! 😈';
      title.className = 'font-cyber text-3xl md:text-4xl font-black text-[#ff2a5f] mb-2 tracking-wide';
      sub.textContent = 'Quedó igual o mayor número de impostores que inocentes. ¡Engaño total!';
    }

    if (state.secretCard) {
      if (resImg) resImg.src = state.secretCard.image;
      if (resTitle) resTitle.textContent = `${state.secretCard.name} (${state.secretCard.anime})`;
    }
  } else {
    gameoverModal.classList.remove('flex');
    gameoverModal.classList.add('hidden');
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
