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
  phase: 'LOBBY', // 'LOBBY' | 'VIEWING' | 'PLAYING' | 'ACCUSING' | 'ROUND_RESULT' | 'GAME_OVER'
  players: [
    { id: 'p1', name: 'Jugador 1', isImpostor: false, hasViewedCard: false, isEliminated: false, eliminatedAs: null },
    { id: 'p2', name: 'Jugador 2', isImpostor: false, hasViewedCard: false, isEliminated: false, eliminatedAs: null },
    { id: 'p3', name: 'Jugador 3', isImpostor: false, hasViewedCard: false, isEliminated: false, eliminatedAs: null },
    { id: 'p4', name: 'Jugador 4', isImpostor: false, hasViewedCard: false, isEliminated: false, eliminatedAs: null }
  ],
  currentViewingIndex: 0,
  secretCard: null,
  impostorCount: 1,
  selectedCategory: 'ALL',
  showOverlaySecret: true,
  round: 1,
  startingPlayer: null, // { id, name }
  lastAccusation: null, // { accusedName, isImpostor, gameOver, winner, nextStartingPlayer }
  winner: null // 'INNOCENTS' | 'IMPOSTORS' | null
};

function broadcastState() {
  io.emit('state_update', getPublicState());
}

function getPublicState() {
  const isOver = gameState.phase === 'GAME_OVER';

  return {
    phase: gameState.phase,
    round: gameState.round,
    startingPlayer: gameState.startingPlayer,
    lastAccusation: gameState.lastAccusation,
    winner: gameState.winner,
    players: gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      hasViewedCard: p.hasViewedCard,
      isEliminated: p.isEliminated,
      eliminatedAs: p.eliminatedAs,
      isImpostor: (isOver || p.isEliminated) ? p.isImpostor : undefined
    })),
    currentViewingIndex: gameState.currentViewingIndex,
    currentViewingPlayer: gameState.players[gameState.currentViewingIndex] ? {
      id: gameState.players[gameState.currentViewingIndex].id,
      name: gameState.players[gameState.currentViewingIndex].name
    } : null,
    secretCard: gameState.secretCard,
    showOverlaySecret: gameState.showOverlaySecret,
    impostorCount: gameState.impostorCount,
    selectedCategory: gameState.selectedCategory,
    totalCards: animeCards.length
  };
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

// Helper to pick random starting player from alive players
function pickRandomAlivePlayer(excludeId) {
  let candidates = gameState.players.filter(p => !p.isEliminated);
  if (excludeId && candidates.length > 1) {
    candidates = candidates.filter(p => p.id !== excludeId);
  }
  if (candidates.length === 0) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return { id: candidates[idx].id, name: candidates[idx].name };
}

// Serve static assets with no-cache headers to prevent browser caching old stylesheets/animations
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0
}));
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

// REST API for cards
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
  socket.emit('state_update', getPublicState());

  // Pass-the-phone: Player requests their private card
  socket.on('get_player_card', (data, callback) => {
    const { playerIndex } = data || {};
    const targetIndex = (playerIndex !== undefined) ? playerIndex : gameState.currentViewingIndex;
    const player = gameState.players[targetIndex];

    if (!player || !gameState.secretCard) {
      if (typeof callback === 'function') callback({ error: 'Partida no iniciada' });
      return;
    }

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
      // Everyone viewed their card! Pick who starts speaking and enter PLAYING phase
      gameState.phase = 'PLAYING';
      gameState.startingPlayer = pickRandomAlivePlayer();
      broadcastState();
      io.emit('all_players_ready');
    }
  });

  socket.on('phone_set_player_index', (idx) => {
    if (idx >= 0 && idx < gameState.players.length) {
      gameState.currentViewingIndex = idx;
      broadcastState();
    }
  });

  // Open accusation screen ("Elegir impostor")
  socket.on('start_accusing', () => {
    if (gameState.phase === 'PLAYING') {
      gameState.phase = 'ACCUSING';
      broadcastState();
    }
  });

  // Cancel accusation and return to playing
  socket.on('cancel_accusing', () => {
    if (gameState.phase === 'ACCUSING') {
      gameState.phase = 'PLAYING';
      broadcastState();
    }
  });

  // ACCUSE / CHOOSE IMPOSTOR
  socket.on('accuse_player', ({ targetId }) => {
    const target = gameState.players.find(p => p.id === targetId);
    if (!target || target.isEliminated) return;

    target.isEliminated = true;

    if (target.isImpostor) {
      // Caught an impostor!
      target.eliminatedAs = 'IMPOSTOR';
      const aliveImpostors = gameState.players.filter(p => !p.isEliminated && p.isImpostor).length;

      if (aliveImpostors === 0) {
        // ALL IMPOSTORS ELIMINATED -> INNOCENTS WIN!
        gameState.phase = 'GAME_OVER';
        gameState.winner = 'INNOCENTS';
        gameState.lastAccusation = {
          accusedName: target.name,
          isImpostor: true,
          gameOver: true,
          winner: 'INNOCENTS'
        };
      } else {
        // There is still another impostor alive! Continue game
        const nextStarter = pickRandomAlivePlayer(target.id);
        gameState.startingPlayer = nextStarter;
        gameState.round++;
        gameState.phase = 'ROUND_RESULT';
        gameState.lastAccusation = {
          accusedName: target.name,
          isImpostor: true,
          gameOver: false,
          winner: null,
          nextStartingPlayer: nextStarter
        };
      }
    } else {
      // Innocent was falsely accused and eliminated!
      target.eliminatedAs = 'INNOCENT';
      const aliveImpostors = gameState.players.filter(p => !p.isEliminated && p.isImpostor).length;
      const aliveInnocents = gameState.players.filter(p => !p.isEliminated && !p.isImpostor).length;

      // Victory condition requested:
      // "hasta que quede un numero igual de impostores que no, ahí ya ganaron los impostores"
      if (aliveImpostors >= aliveInnocents) {
        gameState.phase = 'GAME_OVER';
        gameState.winner = 'IMPOSTORS';
        gameState.lastAccusation = {
          accusedName: target.name,
          isImpostor: false,
          gameOver: true,
          winner: 'IMPOSTORS'
        };
      } else {
        // Game continues! Choose next player to start the new round
        const nextStarter = pickRandomAlivePlayer(target.id);
        gameState.startingPlayer = nextStarter;
        gameState.round++;
        gameState.phase = 'ROUND_RESULT';
        gameState.lastAccusation = {
          accusedName: target.name,
          isImpostor: false,
          gameOver: false,
          winner: null,
          nextStartingPlayer: nextStarter
        };
      }
    }

    broadcastState();
  });

  // Advance from ROUND_RESULT back to PLAYING for next round
  socket.on('next_round', () => {
    if (gameState.phase === 'ROUND_RESULT') {
      gameState.phase = 'PLAYING';
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
        isEliminated: false,
        eliminatedAs: null
      }));
      gameState.currentViewingIndex = 0;
      broadcastState();
    }
  });

  socket.on('admin_start_game', (options) => {
    const { category, impostorCount, customCardId } = options || {};

    if (customCardId) {
      const found = animeCards.find(c => c.id === customCardId);
      gameState.secretCard = found || pickRandomCard(category);
    } else {
      gameState.selectedCategory = category || 'ALL';
      gameState.secretCard = pickRandomCard(gameState.selectedCategory);
    }

    gameState.impostorCount = Math.min(impostorCount || 1, Math.floor(gameState.players.length / 2));
    const totalPlayers = gameState.players.length;
    const impostorIndices = new Set();
    while (impostorIndices.size < gameState.impostorCount) {
      impostorIndices.add(Math.floor(Math.random() * totalPlayers));
    }

    gameState.players.forEach((p, idx) => {
      p.isImpostor = impostorIndices.has(idx);
      p.hasViewedCard = false;
      p.isEliminated = false;
      p.eliminatedAs = null;
    });

    gameState.currentViewingIndex = 0;
    gameState.phase = 'VIEWING';
    gameState.round = 1;
    gameState.startingPlayer = null;
    gameState.lastAccusation = null;
    gameState.winner = null;

    broadcastState();
    io.emit('game_started');
  });

  socket.on('admin_toggle_overlay_secret', (visible) => {
    gameState.showOverlaySecret = (visible !== undefined) ? visible : !gameState.showOverlaySecret;
    broadcastState();
  });

  socket.on('admin_pick_starter', () => {
    gameState.startingPlayer = pickRandomAlivePlayer();
    broadcastState();
  });

  socket.on('admin_reset_game', () => {
    gameState.phase = 'LOBBY';
    gameState.secretCard = null;
    gameState.currentViewingIndex = 0;
    gameState.round = 1;
    gameState.startingPlayer = null;
    gameState.lastAccusation = null;
    gameState.winner = null;
    gameState.players.forEach(p => {
      p.isImpostor = false;
      p.hasViewedCard = false;
      p.isEliminated = false;
      p.eliminatedAs = null;
    });
    broadcastState();
  });
});

server.listen(PORT, () => {
  console.log(`Anime Impostor server running on port ${PORT}`);
});
