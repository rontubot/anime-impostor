// Pass-the-phone Client Logic
const socket = io();

let latestState = null;
let selectedManualIndex = null;

const views = {
  lobby: document.getElementById('view-lobby'),
  pass: document.getElementById('view-pass'),
  card: document.getElementById('view-card'),
  discussion: document.getElementById('view-discussion'),
  voting: document.getElementById('view-voting'),
  results: document.getElementById('view-results')
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

socket.on('timer_tick', ({ timerCurrent }) => {
  if (latestState) latestState.timerCurrent = timerCurrent;
  updateTimerUI(timerCurrent);
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTimerUI(seconds) {
  const discTimer = document.getElementById('disc-timer-display');
  const pillTimer = document.getElementById('play-timer-text');
  const pillBox = document.getElementById('play-timer-pill');

  if (discTimer) discTimer.textContent = formatTime(seconds);
  if (pillTimer) pillTimer.textContent = formatTime(seconds);

  if (pillBox) {
    if (latestState && (latestState.phase === 'DISCUSSION' || latestState.phase === 'VOTING')) {
      pillBox.classList.remove('hidden');
      pillBox.classList.add('inline-flex');
    } else {
      pillBox.classList.remove('inline-flex');
      pillBox.classList.add('hidden');
    }
  }
}

function handleStateUpdate(state) {
  updateTimerUI(state.timerCurrent);

  switch (state.phase) {
    case 'LOBBY':
      renderLobby(state);
      showView('lobby');
      break;

    case 'VIEWING':
      // If we are currently showing a secret card, don't abruptly close it unless currentViewingIndex moved
      if (!views.card.classList.contains('hidden')) {
        return;
      }
      renderPassScreen(state);
      showView('pass');
      break;

    case 'DISCUSSION':
      showView('discussion');
      break;

    case 'VOTING':
      renderVoting(state);
      showView('voting');
      break;

    case 'RESULTS':
      renderResults(state);
      showView('results');
      break;
  }
}

function renderLobby(state) {
  const container = document.getElementById('lobby-player-tags');
  if (!container) return;

  container.innerHTML = state.players.map((p, idx) => `
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

  // Populate manual picker list if needed
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

// Toggle manual player list
const btnTogglePicker = document.getElementById('btn-toggle-picker');
if (btnTogglePicker) {
  btnTogglePicker.addEventListener('click', () => {
    const list = document.getElementById('manual-picker-list');
    list.classList.toggle('hidden');
  });
}

// REVEAL CARD BUTTON CLICK
const btnReveal = document.getElementById('btn-reveal-card');
if (btnReveal) {
  btnReveal.addEventListener('click', () => {
    const targetIdx = (selectedManualIndex !== null) ? selectedManualIndex : latestState.currentViewingIndex;

    socket.emit('get_player_card', { playerIndex: targetIdx }, (response) => {
      if (!response || response.error) {
        alert(response?.error || 'Error al obtener la carta');
        return;
      }

      showView('card');

      const cardInnocent = document.getElementById('card-innocent');
      const cardImpostor = document.getElementById('card-impostor');

      if (response.isImpostor) {
        // IMPOSTOR CARD
        cardInnocent.classList.add('hidden');
        cardInnocent.classList.remove('flex');
        cardImpostor.classList.remove('hidden');
        cardImpostor.classList.add('flex');

        document.getElementById('impostor-hint-text').textContent = response.hint || 'Sin pista adicional.';
        document.getElementById('impostor-category-tag').textContent = response.category || 'Anime General';

        if (window.soundManager) window.soundManager.playImpostorAlert();
      } else {
        // INNOCENT CARD
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

        if (window.soundManager) window.soundManager.playCardReveal();
      }

      if (window.lucide) lucide.createIcons();
    });
  });
}

// HIDE AND PASS TO NEXT PLAYER
function hideAndPassNext() {
  selectedManualIndex = null;
  // Shake / hide view immediately
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

// VOTING LOGIC
function renderVoting(state) {
  const grid = document.getElementById('voting-candidates-grid');
  if (!grid) return;

  grid.innerHTML = state.players.map((p) => `
    <button onclick="voteForPlayer('${p.id}')" class="p-3.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:border-pink-500 hover:bg-pink-950/20 active:scale-98 transition flex items-center justify-between text-left">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-cyber text-xs font-bold">
          ${p.name.charAt(0).toUpperCase()}
        </div>
        <span class="font-bold text-white text-sm">${p.name}</span>
      </div>
      <span class="text-xs text-pink-400 font-semibold flex items-center gap-1">
        Votar <i data-lucide="chevron-right" class="w-4 h-4"></i>
      </span>
    </button>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

window.voteForPlayer = function(targetId) {
  // Pass the target to server
  const voter = latestState.players[latestState.currentViewingIndex] || latestState.players[0];
  socket.emit('phone_vote', {
    voterId: voter.id,
    targetId: targetId
  });

  const msg = document.getElementById('vote-confirmed-msg');
  if (msg) {
    msg.classList.remove('hidden');
    setTimeout(() => {
      msg.classList.add('hidden');
    }, 3000);
  }

  if (window.soundManager) window.soundManager.playTick();
};

function renderResults(state) {
  const container = document.getElementById('phone-impostors-list');
  if (!container) return;

  const impostors = state.players.filter(p => p.isImpostor);
  container.innerHTML = impostors.map(imp => `
    <div class="p-4 rounded-xl border border-red-500 bg-red-950/40 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <i data-lucide="skull" class="w-6 h-6 text-red-400"></i>
        <span class="font-cyber font-bold text-white">${imp.name}</span>
      </div>
      <span class="badge-cyber badge-red text-xs">ERA EL IMPOSTOR</span>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}
