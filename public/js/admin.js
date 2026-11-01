// Streamer Host / Admin Controller
const socket = io();

let currentPlayers = [
  { id: 'p1', name: 'Jugador 1' },
  { id: 'p2', name: 'Jugador 2' },
  { id: 'p3', name: 'Jugador 3' },
  { id: 'p4', name: 'Jugador 4' }
];

let impostorCount = 1;
let latestState = null;

// Load saved players from localStorage if available
try {
  const saved = localStorage.getItem('anime_impostor_players');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length >= 3 && parsed.length <= 8) {
      currentPlayers = parsed;
    }
  }
} catch (e) {}

// Populate URLs & QR Code
function setupUrls() {
  const origin = window.location.origin;
  const overlayUrl = `${origin}/overlay`;
  const playUrl = `${origin}/play`;

  const inputOverlay = document.getElementById('input-overlay-url');
  const inputPlay = document.getElementById('input-play-url');
  const qrImg = document.getElementById('qr-code-img');

  if (inputOverlay) inputOverlay.value = overlayUrl;
  if (inputPlay) inputPlay.value = playUrl;
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(playUrl)}`;
  }
}

window.copyToClipboard = function(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.select();
    navigator.clipboard.writeText(el.value).then(() => {
      alert('¡Enlace copiado al portapapeles!');
    });
  }
};

socket.on('connect', () => {
  setupUrls();
  // Sync players list initially
  socket.emit('admin_set_players', currentPlayers);
});

socket.on('state_update', (state) => {
  latestState = state;
  renderAdminState(state);
});

socket.on('timer_tick', ({ timerCurrent }) => {
  const tEl = document.getElementById('admin-timer');
  if (tEl) tEl.textContent = formatTime(timerCurrent);
});

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function renderAdminState(state) {
  // Phase badge
  const phaseBadge = document.getElementById('admin-phase-badge');
  const phasesMap = {
    LOBBY: { text: 'ESPERANDO INICIO', color: 'bg-emerald-400' },
    VIEWING: { text: 'PASANDO EL TELÉFONO', color: 'bg-amber-400' },
    DISCUSSION: { text: 'DEBATE / DISCUSIÓN', color: 'bg-cyan-400' },
    VOTING: { text: 'VOTACIÓN', color: 'bg-purple-500' },
    RESULTS: { text: 'RESULTADOS', color: 'bg-pink-500' }
  };
  const currentP = phasesMap[state.phase] || { text: state.phase, color: 'bg-blue-400' };
  if (phaseBadge) {
    phaseBadge.innerHTML = `<span class="w-3 h-3 rounded-full ${currentP.color} animate-pulse"></span> <span>${currentP.text}</span>`;
  }

  // Timer
  const tEl = document.getElementById('admin-timer');
  if (tEl) tEl.textContent = formatTime(state.timerCurrent);

  // Host secret card preview
  const prevImg = document.getElementById('host-preview-img');
  const prevName = document.getElementById('host-preview-name');
  const prevAnime = document.getElementById('host-preview-anime');
  const prevHint = document.getElementById('host-preview-hint');

  if (state.secretCard && state.phase !== 'LOBBY') {
    if (prevImg) prevImg.src = state.secretCard.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
    if (prevName) prevName.textContent = state.secretCard.name;
    if (prevAnime) prevAnime.textContent = `${state.secretCard.anime} (${state.secretCard.category})`;
    if (prevHint) prevHint.textContent = state.secretCard.hint;
  } else {
    if (prevName) prevName.textContent = 'Ninguna ronda activa';
    if (prevAnime) prevAnime.textContent = 'Presiona "Iniciar Partida" para sortear un personaje';
    if (prevHint) prevHint.textContent = 'Pista del impostor: -';
  }

  // Overlay checkbox sync
  const toggleOverlay = document.getElementById('toggle-overlay-secret');
  if (toggleOverlay) {
    toggleOverlay.checked = state.showOverlaySecret;
  }
}

// PLAYERS MANAGEMENT UI
function renderPlayersInputs() {
  const container = document.getElementById('players-edit-list');
  if (!container) return;

  container.innerHTML = currentPlayers.map((p, idx) => `
    <div class="flex items-center gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
      <span class="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 text-xs font-bold font-cyber flex items-center justify-center flex-shrink-0">
        ${idx + 1}
      </span>
      <input type="text" value="${p.name}" oninput="updatePlayerName(${idx}, this.value)" class="flex-1 bg-transparent border-none text-xs text-white focus:outline-none font-semibold">
      ${currentPlayers.length > 3 ? `
        <button onclick="removePlayer(${idx})" class="text-rose-400 hover:text-rose-300 p-1">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      ` : ''}
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

window.updatePlayerName = function(idx, newName) {
  if (currentPlayers[idx]) {
    currentPlayers[idx].name = newName;
  }
};

window.removePlayer = function(idx) {
  if (currentPlayers.length > 3) {
    currentPlayers.splice(idx, 1);
    renderPlayersInputs();
  }
};

document.getElementById('btn-add-player').addEventListener('click', () => {
  if (currentPlayers.length < 8) {
    const nextNum = currentPlayers.length + 1;
    currentPlayers.push({
      id: `p_${Date.now()}_${nextNum}`,
      name: `Jugador ${nextNum}`
    });
    renderPlayersInputs();
  } else {
    alert('El juego admite un máximo de 8 jugadores.');
  }
});

window.setPlayerPreset = function(count) {
  currentPlayers = [];
  for (let i = 1; i <= count; i++) {
    currentPlayers.push({
      id: `p${i}`,
      name: `Jugador ${i}`
    });
  }
  renderPlayersInputs();
  saveAndBroadcastPlayers();
};

function saveAndBroadcastPlayers() {
  try {
    localStorage.setItem('anime_impostor_players', JSON.stringify(currentPlayers));
  } catch (e) {}
  socket.emit('admin_set_players', currentPlayers);
}

document.getElementById('btn-save-players').addEventListener('click', () => {
  saveAndBroadcastPlayers();
  alert('¡Lista de jugadores guardada y sincronizada!');
});

// IMPOSTOR COUNT
window.setImpostorCount = function(count) {
  impostorCount = count;
  const b1 = document.getElementById('btn-imp-1');
  const b2 = document.getElementById('btn-imp-2');

  if (count === 1) {
    b1.className = 'p-2.5 rounded-xl border border-pink-500 bg-pink-950/40 text-pink-300 font-bold font-cyber text-center';
    b2.className = 'p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 font-bold font-cyber text-center hover:border-slate-600';
  } else {
    b2.className = 'p-2.5 rounded-xl border border-pink-500 bg-pink-950/40 text-pink-300 font-bold font-cyber text-center';
    b1.className = 'p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 font-bold font-cyber text-center hover:border-slate-600';
  }
};

// ACTIONS
document.getElementById('btn-start-game').addEventListener('click', () => {
  saveAndBroadcastPlayers();

  const category = document.getElementById('select-category').value;
  const timerDuration = parseInt(document.getElementById('select-timer-duration').value, 10);

  socket.emit('admin_start_game', {
    category,
    impostorCount,
    timerDuration
  });
});

document.getElementById('btn-phase-discussion').addEventListener('click', () => {
  socket.emit('admin_set_phase', 'DISCUSSION');
});

document.getElementById('btn-phase-voting').addEventListener('click', () => {
  socket.emit('admin_set_phase', 'VOTING');
});

document.getElementById('btn-phase-results').addEventListener('click', () => {
  socket.emit('admin_set_phase', 'RESULTS');
});

// TIMER CONTROLS
document.getElementById('btn-timer-start').addEventListener('click', () => {
  socket.emit('admin_timer_action', 'start');
});

document.getElementById('btn-timer-pause').addEventListener('click', () => {
  socket.emit('admin_timer_action', 'pause');
});

document.getElementById('btn-timer-reset').addEventListener('click', () => {
  socket.emit('admin_timer_action', 'reset');
});

// OVERLAY SECRET TOGGLE
document.getElementById('toggle-overlay-secret').addEventListener('change', (e) => {
  socket.emit('admin_toggle_overlay_secret', e.target.checked);
});

// CUSTOM ANIME CARD FORM
document.getElementById('form-custom-card').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('custom-name').value.trim();
  const anime = document.getElementById('custom-anime').value.trim();
  const image = document.getElementById('custom-image').value.trim();
  const hint = document.getElementById('custom-hint').value.trim();

  fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, anime, image, hint, category: 'Personalizado' })
  })
  .then(res => res.json())
  .then(data => {
    alert(`¡Personaje "${name}" agregado con éxito al mazo!`);
    e.target.reset();
  })
  .catch(err => {
    alert('Error al agregar el personaje');
  });
});

// Initialize UI
renderPlayersInputs();
setupUrls();
