const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Load anime cards database
const CARDS_FILE = path.join(__dirname, 'data', 'anime_cards.json');
let animeCards = [];
try {
  if (fs.existsSync(CARDS_FILE)) {
    animeCards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'));
  }
} catch (err) {
  console.error('Error reading anime cards:', err);
}

// Game State
const gameState = {
  phase: 'LOBBY', // 'LOBBY' | 'VIEWING' | 'DISCUSSION' | 'VOTING' | 'RESULTS'
  players: [
    { id: 'p1', name: 'Jugador 1', isImpostor: false, hasViewedCard: false, votedFor: null },
    { id: 'p2', name: 'Jugador 2', isImpostor: false, hasViewedCard: false, votedFor: null },
    { id: 'p3', name: 'Jugador 3', isImpostor: false, hasViewedCard: false, votedFor: null },
    { id: 'p4', name: 'Jugador 4', isImpostor: false, hasViewedCard: false, votedFor: null }
  ],
  currentViewingIndex: 0,
  secretCard: null,
  impostorCount: 1,
  selectedCategory: 'ALL',
  discussionSeconds: 180,
  timerCurrent: 180,
  timerRunning: false,
  showOverlaySecret: true, // Whether OBS overlay shows secret card at bottom center
  eliminatedPlayerId: null,
  impostorWon: null
};

let timerInterval = null;

function broadcastState() {
  // Broadcast public state to everyone (overlay, viewers, etc.)
  io.emit('state_update', getPublicState());
}

function getPublicState() {
  return {
    phase: gameState.phase,
    players: gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      hasViewedCard: p.hasViewedCard,
      votedFor: gameState.phase === 'RESULTS' ? p.votedFor : (p.votedFor ? true : false),
      isImpostor: gameState.phase === 'RESULTS' ? p.isImpostor : undefined
    })),
    currentViewingIndex: gameState.currentViewingIndex,
    currentViewingPlayer: gameState.players[gameState.currentViewingIndex] ? {
      id: gameState.players[gameState.currentViewingIndex].id,
      name: gameState.players[gameState.currentViewingIndex].name
    } : null,
    secretCard: gameState.secretCard,
    showOverlaySecret: gameState.showOverlaySecret,
    timerCurrent: gameState.timerCurrent,
    timerRunning: gameState.timerRunning,
    impostorCount: gameState.impostorCount,
    selectedCategory: gameState.selectedCategory,
    eliminatedPlayerId: gameState.eliminatedPlayerId,
    impostorWon: gameState.impostorWon,
    totalCards: animeCards.length
  };
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  gameState.timerRunning = true;
  timerInterval = setInterval(() => {
    if (gameState.timerCurrent > 0) {
      gameState.timerCurrent--;
      io.emit('timer_tick', { timerCurrent: gameState.timerCurrent });
    } else {
      stopTimer();
      io.emit('timer_finished');
    }
  }, 1000);
  broadcastState();
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  gameState.timerRunning = false;
  broadcastState();
}

function resetTimer() {
  stopTimer();
  gameState.timerCurrent = gameState.discussionSeconds;
  broadcastState();
}

// Helper to pick random card
function pickRandomCard(category) {
  let pool = animeCards;
  if (category && category !== 'ALL') {
    pool = animeCards.filter(c => c.category === category);
  }
  if (!pool || pool.length === 0) pool = animeCards;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// REST API for cards management
app.get('/api/cards', (req, res) => {
  res.json(animeCards);
});

app.post('/api/cards', (req, res) => {
  const { name, anime, category, image, hint } = req.body;
  if (!name || !anime) {
    return res.status(400).json({ error: 'Nombre y anime son requeridos' });
  }
  const newCard = {
    id: 'custom_' + Date.now(),
    name,
    anime,
    category: category || 'Personalizado',
    image: image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
    hint: hint || 'Pista: Personaje de anime misterioso.'
  };
  animeCards.unshift(newCard);
  try {
    fs.writeFileSync(CARDS_FILE, JSON.stringify(animeCards, null, 2));
  } catch (e) {
    console.error('Failed saving card to disk', e);
  }
  res.json({ success: true, card: newCard, totalCards: animeCards.length });
});

// Socket connection
io.on('connection', (socket) => {
  // Send initial public state immediately
  socket.emit('state_update', getPublicState());

  // Pass-the-phone: Player requests their private card details for their specific slot
  socket.on('get_player_card', (data, callback) => {
    const { playerIndex } = data || {};
    const targetIndex = (playerIndex !== undefined) ? playerIndex : gameState.currentViewingIndex;
    const player = gameState.players[targetIndex];

    if (!player || !gameState.secretCard) {
      if (typeof callback === 'function') callback({ error: 'Partida no iniciada' });
      return;
    }

    // Mark as viewed
    player.hasViewedCard = true;
    broadcastState();

    if (player.isImpostor) {
      if (typeof callback === 'function') {
        callback({
          isImpostor: true,
          playerName: player.name,
          hint: gameState.secretCard.hint,
          category: gameState.secretCard.category,
          totalImpostors: gameState.impostorCount
        });
      }
    } else {
      if (typeof callback === 'function') {
        callback({
          isImpostor: false,
          playerName: player.name,
          card: gameState.secretCard
        });
      }
    }
  });

  // Next player in pass-the-phone loop
  socket.on('phone_next_player', () => {
    if (gameState.currentViewingIndex < gameState.players.length - 1) {
      gameState.currentViewingIndex++;
      broadcastState();
    } else {
      // Everyone has viewed! Auto advance to Discussion
      gameState.phase = 'DISCUSSION';
      gameState.timerCurrent = gameState.discussionSeconds;
      startTimer();
      broadcastState();
      io.emit('all_players_ready');
    }
  });

  // Set specific viewing player index
  socket.on('phone_set_player_index', (idx) => {
    if (idx >= 0 && idx < gameState.players.length) {
      gameState.currentViewingIndex = idx;
      broadcastState();
    }
  });

  // Player casts vote
  socket.on('phone_vote', ({ voterId, targetId }) => {
    const voter = gameState.players.find(p => p.id === voterId);
    if (voter) {
      voter.votedFor = targetId;
      broadcastState();
    }
  });

  // ADMIN CONTROLS
  socket.on('admin_set_players', (playersList) => {
    if (Array.isArray(playersList) && playersList.length >= 3 && playersList.length <= 8) {
      gameState.players = playersList.map((p, i) => ({
        id: p.id || `p_${i + 1}`,
        name: p.name || `Jugador ${i + 1}`,
        isImpostor: false,
        hasViewedCard: false,
        votedFor: null
      }));
      gameState.currentViewingIndex = 0;
      broadcastState();
    }
  });

  socket.on('admin_start_game', (options) => {
    const { category, impostorCount, customCardId, timerDuration } = options || {};

    if (timerDuration) {
      gameState.discussionSeconds = parseInt(timerDuration, 10) || 180;
    }

    // Pick card
    if (customCardId) {
      const found = animeCards.find(c => c.id === customCardId);
      gameState.secretCard = found || pickRandomCard(category);
    } else {
      gameState.selectedCategory = category || 'ALL';
      gameState.secretCard = pickRandomCard(gameState.selectedCategory);
    }

    // Assign impostors randomly
    gameState.impostorCount = Math.min(impostorCount || 1, Math.floor(gameState.players.length / 2));
    const totalPlayers = gameState.players.length;
    const impostorIndices = new Set();
    while (impostorIndices.size < gameState.impostorCount) {
      impostorIndices.add(Math.floor(Math.random() * totalPlayers));
    }

    gameState.players.forEach((p, idx) => {
      p.isImpostor = impostorIndices.has(idx);
      p.hasViewedCard = false;
      p.votedFor = null;
    });

    gameState.currentViewingIndex = 0;
    gameState.phase = 'VIEWING';
    gameState.eliminatedPlayerId = null;
    gameState.impostorWon = null;
    stopTimer();
    gameState.timerCurrent = gameState.discussionSeconds;

    broadcastState();
    io.emit('game_started');
  });

  socket.on('admin_set_phase', (phase) => {
    gameState.phase = phase;
    if (phase === 'DISCUSSION') {
      startTimer();
    } else if (phase === 'RESULTS') {
      stopTimer();
      // Calculate votes
      const voteCounts = {};
      gameState.players.forEach(p => {
        if (p.votedFor) {
          voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
        }
      });
      let highestVotes = 0;
      let eliminated = null;
      for (const [id, count] of Object.entries(voteCounts)) {
        if (count > highestVotes) {
          highestVotes = count;
          eliminated = id;
        }
      }
      gameState.eliminatedPlayerId = eliminated;
      const eliminatedPlayer = gameState.players.find(p => p.id === eliminated);
      if (eliminatedPlayer && eliminatedPlayer.isImpostor) {
        gameState.impostorWon = false; // Innocent won
      } else {
        gameState.impostorWon = true; // Impostor escaped or innocent eliminated
      }
    } else {
      stopTimer();
    }
    broadcastState();
  });

  socket.on('admin_toggle_overlay_secret', (visible) => {
    gameState.showOverlaySecret = (visible !== undefined) ? visible : !gameState.showOverlaySecret;
    broadcastState();
  });

  socket.on('admin_timer_action', (action) => {
    if (action === 'start') startTimer();
    if (action === 'pause') stopTimer();
    if (action === 'reset') resetTimer();
  });

  socket.on('admin_reset_game', () => {
    stopTimer();
    gameState.phase = 'LOBBY';
    gameState.secretCard = null;
    gameState.currentViewingIndex = 0;
    gameState.players.forEach(p => {
      p.isImpostor = false;
      p.hasViewedCard = false;
      p.votedFor = null;
    });
    gameState.eliminatedPlayerId = null;
    gameState.impostorWon = null;
    broadcastState();
  });

  // Sound trigger to play anime sound effects across clients (overlay / stream)
  socket.on('trigger_sound', (soundName) => {
    io.emit('play_sound', soundName);
  });
});

server.listen(PORT, () => {
  console.log(`Anime Impostor server running on port ${PORT}`);
});
