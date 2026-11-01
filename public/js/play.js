// Pass-the-phone Client Logic
const socket = io();

let latestState = null;
let selectedManualIndex = null;

const views = {
  lobby: document.getElementById('view-lobby'),
  pass: document.getElementById('view-pass'),
  card: document.getElementById('view-card'),
  playing: document.getElementById('view-playing'),
  accusing: document.getElementById('view-accusing'),
  roundResult: document.getElementById('view-round-result'),
  gameOver: document.getElementById('view-game-over')
};

function showView(viewName) {
  Object.keys(views).forEach(key => {
    if (views[key]) {
      if (key === viewName) {
        views[key].classList.remove('hidden');
        views[key].classList.add('flex');
      } else {
        views[key].classList.add('hidden');
        views[key].classList.remove('flex');
      }
    }
  });
  if (window.lucide) lucide.createIcons();
}

socket.on('connect', () => {
  const dot = document.getElementById('connection-dot');
  if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
});

socket.on('disconnect', () => {
  const dot = document.getElementById('connection-dot');
  if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 animate-ping';
});

socket.on('state_update', (state) => {
  latestState = state;
  handleStateUpdate(state);
});

function handleStateUpdate(state) {
  // Update header round pill
  const roundPill = document.getElementById('play-round-pill');
  const roundText = document.getElementById('play-round-text');
  if (roundPill && roundText) {
    if (state.phase !== 'LOBBY' && state.phase !== 'VIEWING') {
      roundPill.classList.remove('hidden');
      roundPill.classList.add('inline-flex');
      roundText.textContent = `RONDA ${state.round}`;
    } else {
      roundPill.classList.remove('inline-flex');
      roundPill.classList.add('hidden');
    }
  }

  switch (state.phase) {
    case 'LOBBY':
      renderLobby(state);
      showView('lobby');
      break;

    case 'VIEWING':
      if (!views.card.classList.contains('hidden')) {
        return; // Don't interrupt if someone is currently looking at their card
      }
      renderPassScreen(state);
      showView('pass');
      break;

    case 'PLAYING':
      renderPlaying(state);
      showView('playing');
      break;

    case 'ACCUSING':
      renderAccusing(state);
      showView('accusing');
      break;

    case 'ROUND_RESULT':
      renderRoundResult(state);
      showView('roundResult');
      break;

    case 'GAME_OVER':
      renderGameOver(state);
      showView('gameOver');
      break;
  }
}

function renderLobby(state) {
  const container = document.getElementById('lobby-player-tags');
  if (!container) return;

  container.innerHTML = state.players.map((p) => `
    <span class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
      ${p.name}
    </span>
  `).join('');
}

function renderPassScreen(state) {
  const target = state.currentViewingPlayer;
  const nameEl = document.getElementById('pass-target-name');
  if (nameEl && target) {
    nameEl.textContent = target.name;
  }

  const manualList = document.getElementById('manual-picker-list');
  if (manualList) {
    manualList.innerHTML = state.players.map((p, idx) => `
      <button onclick="selectManualPlayer(${idx})" class="p-2 rounded-lg text-left border ${idx === state.currentViewingIndex ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-300'}">
        ${p.name} ${p.hasViewedCard ? '✓' : ''}
      </button>
    `).join('');
  }
}

window.selectManualPlayer = function(index) {
  selectedManualIndex = index;
  socket.emit('phone_set_player_index', index);
  document.getElementById('manual-picker-list').classList.add('hidden');
};

const btnTogglePicker = document.getElementById('btn-toggle-picker');
if (btnTogglePicker) {
  btnTogglePicker.addEventListener('click', () => {
    const list = document.getElementById('manual-picker-list');
    list.classList.toggle('hidden');
  });
}

// REVEAL CARD CLICK
const btnReveal = document.getElementById('btn-reveal-card');
if (btnReveal) {
  btnReveal.addEventListener('click', () => {
    const targetIdx = (selectedManualIndex !== null) ? selectedManualIndex : latestState.currentViewingIndex;

    socket.emit('get_player_card', { playerIndex: targetIdx }, (response) => {
      if (!response || response.error) {
        showInAppToast(response?.error || 'Error al obtener la carta');
        return;
      }

      showView('card');

      const cardInnocent = document.getElementById('card-innocent');
      const cardImpostor = document.getElementById('card-impostor');

      if (response.isImpostor) {
        cardInnocent.classList.add('hidden');
        cardInnocent.classList.remove('flex');
        cardImpostor.classList.remove('hidden');
        cardImpostor.classList.add('flex');

        document.getElementById('impostor-hint-text').textContent = response.hint || 'Sin pista adicional.';
        document.getElementById('impostor-category-tag').textContent = response.category || 'Anime General';
      } else {
        cardImpostor.classList.add('hidden');
        cardImpostor.classList.remove('flex');
        cardInnocent.classList.remove('hidden');
        cardInnocent.classList.add('flex');

        const card = response.card;
        document.getElementById('innocent-char-name').textContent = card.name;
        document.getElementById('innocent-anime-name').textContent = card.anime;
        document.getElementById('innocent-cat-pill').textContent = card.category;

        const img = document.getElementById('innocent-char-img');
        if (img) {
          img.src = card.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
          img.onerror = () => {
            img.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
          };
        }
      }

      if (window.lucide) lucide.createIcons();
    });
  });
}

// HIDE AND ADVANCE
function hideAndPassNext() {
  selectedManualIndex = null;
  views.card.classList.add('hidden');
  views.card.classList.remove('flex');
  socket.emit('phone_next_player');
}

const btnHideInnocent = document.getElementById('btn-hide-innocent');
if (btnHideInnocent) {
  btnHideInnocent.addEventListener('click', hideAndPassNext);
}

const btnHideImpostor = document.getElementById('btn-hide-impostor');
if (btnHideImpostor) {
  btnHideImpostor.addEventListener('click', hideAndPassNext);
}

// PLAYING VIEW (TABLE DISCUSSION)
function renderPlaying(state) {
  const roundBadge = document.getElementById('playing-round-badge');
  const starterName = document.getElementById('playing-starter-name');
  const aliveList = document.getElementById('playing-alive-list');

  if (roundBadge) roundBadge.textContent = `RONDA ${state.round}`;
  if (starterName && state.startingPlayer) starterName.textContent = state.startingPlayer.name;

  if (aliveList) {
    const alivePlayers = state.players.filter(p => !p.isEliminated);
    aliveList.innerHTML = alivePlayers.map(p => `
      <span class="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 ${state.startingPlayer && p.id === state.startingPlayer.id ? 'border-cyan-400 text-cyan-300 font-bold' : ''}">
        ${p.name} ${state.startingPlayer && p.id === state.startingPlayer.id ? '🎤' : ''}
      </span>
    `).join('');
  }
}

// TRIGGER ACCUSING BUTTON
const btnTriggerAccusing = document.getElementById('btn-trigger-accusing');
if (btnTriggerAccusing) {
  btnTriggerAccusing.addEventListener('click', () => {
    socket.emit('start_accusing');
  });
}

// ACCUSING VIEW (CHOOSE 1 PLAYER)
function renderAccusing(state) {
  const grid = document.getElementById('accusing-candidates-grid');
  if (!grid) return;

  const alivePlayers = state.players.filter(p => !p.isEliminated);

  grid.innerHTML = alivePlayers.map((p) => `
    <button onclick="confirmAccusation('${p.id}', '${p.name}')" class="p-3.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:border-pink-500 hover:bg-pink-950/20 active:scale-98 transition flex items-center justify-between text-left">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-cyber text-xs font-bold">
          ${p.name.charAt(0).toUpperCase()}
        </div>
        <span class="font-bold text-white text-sm">${p.name}</span>
      </div>
      <span class="text-xs text-pink-400 font-semibold flex items-center gap-1">
        Acusar <i data-lucide="crosshair" class="w-4 h-4"></i>
      </span>
    </button>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function showInAppToast(text) {
  const toast = document.getElementById('in-app-toast');
  const toastText = document.getElementById('in-app-toast-text');
  if (toast && toastText) {
    toastText.textContent = text;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    setTimeout(() => {
      toast.classList.remove('flex');
      toast.classList.add('hidden');
    }, 2800);
  }
}

window.confirmAccusation = function(targetId, targetName) {
  const modal = document.getElementById('custom-confirm-modal');
  const title = document.getElementById('custom-confirm-title');
  const msg = document.getElementById('custom-confirm-msg');
  const btnConfirm = document.getElementById('btn-modal-confirm');
  const btnCancel = document.getElementById('btn-modal-cancel');

  if (!modal) {
    socket.emit('accuse_player', { targetId });
    return;
  }

  title.textContent = `¿Acusar a "${targetName}"?`;
  msg.textContent = `Si aciertan y es el impostor, ¡ganan la partida! Si es inocente, "${targetName}" quedará eliminado del juego.`;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  btnConfirm.onclick = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    socket.emit('accuse_player', { targetId });
  };

  btnCancel.onclick = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  };
};

const btnCancelAccusing = document.getElementById('btn-cancel-accusing');
if (btnCancelAccusing) {
  btnCancelAccusing.addEventListener('click', () => {
    socket.emit('cancel_accusing');
  });
}

// ROUND RESULT VIEW
function renderRoundResult(state) {
  if (!state.lastAccusation) return;

  const targetNameEl = document.getElementById('rr-target-name');
  const verdictBanner = document.getElementById('rr-verdict-banner');
  const detailEl = document.getElementById('rr-detail-text');
  const nextStarterName = document.getElementById('rr-next-starter-name');

  targetNameEl.textContent = state.lastAccusation.accusedName;

  if (state.lastAccusation.isImpostor) {
    verdictBanner.className = 'w-full p-4 rounded-xl font-bold text-base my-2 bg-red-950/80 border border-red-500 text-red-300';
    verdictBanner.textContent = '¡SÍ ERA EL IMPOSTOR! 💀';
    detailEl.textContent = '¡Descubrieron a un impostor! Pero aún queda otro impostor activo en el juego.';
  } else {
    verdictBanner.className = 'w-full p-4 rounded-xl font-bold text-base my-2 bg-slate-900 border border-emerald-500 text-emerald-300';
    verdictBanner.textContent = '¡NO ERA EL IMPOSTOR! (Era Inocente 🟢)';
    detailEl.textContent = `${state.lastAccusation.accusedName} era inocente. Queda eliminado de la partida.`;
  }

  if (state.lastAccusation.nextStartingPlayer) {
    nextStarterName.textContent = state.lastAccusation.nextStartingPlayer.name;
  }
}

const btnContinueNextRound = document.getElementById('btn-continue-next-round');
if (btnContinueNextRound) {
  btnContinueNextRound.addEventListener('click', () => {
    socket.emit('next_round');
  });
}

// GAME OVER VIEW
function renderGameOver(state) {
  const title = document.getElementById('go-title');
  const subtitle = document.getElementById('go-subtitle');
  const secretName = document.getElementById('go-secret-name');
  const secretAnime = document.getElementById('go-secret-anime');
  const secretImg = document.getElementById('go-secret-img');

  if (state.winner === 'INNOCENTS') {
    title.textContent = '¡LOS INOCENTES GANAN! 🏆';
    title.className = 'font-cyber text-2xl font-black text-emerald-400 mb-2';
    subtitle.textContent = '¡Todos los impostores han sido descubiertos y eliminados!';
  } else {
    title.textContent = '¡LOS IMPOSTORES HAN GANADO! 😈';
    title.className = 'font-cyber text-2xl font-black text-[#ff2a5f] mb-2';
    subtitle.textContent = 'Quedó igual o mayor número de impostores que inocentes. ¡Ganó el engaño!';
  }

  if (state.secretCard) {
    if (secretName) secretName.textContent = state.secretCard.name;
    if (secretAnime) secretAnime.textContent = state.secretCard.anime;
    if (secretImg) secretImg.src = state.secretCard.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
  }
}
