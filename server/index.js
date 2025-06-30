const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())
app.use(express.json())

// Game state
const games = new Map()
const words = [
  'cat',
  'dog',
  'house',
  'tree',
  'car',
  'bike',
  'sun',
  'moon',
  'star',
  'flower',
  'book',
  'phone',
  'computer',
  'table',
  'chair',
  'door',
  'window',
  'clock',
  'apple',
  'banana',
  'pizza',
  'hamburger',
  'coffee',
  'water',
  'mountain',
  'ocean',
  'beach',
  'forest',
  'city',
  'bridge',
  'airplane',
  'train',
  'boat',
]

// Game class
class Game {
  constructor(roomId) {
    this.roomId = roomId
    this.players = []
    this.currentDrawer = null
    this.currentWord = ''
    this.gameState = 'waiting' // waiting, playing, finished
    this.round = 0
    this.maxRounds = 3
    this.scores = {}
    this.drawingData = []
  }

  addPlayer(playerId, playerName) {
    this.players.push({ id: playerId, name: playerName })
    this.scores[playerId] = 0
  }

  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.id !== playerId)
    delete this.scores[playerId]
  }

  startGame() {
    if (this.players.length < 2) return false

    this.gameState = 'playing'
    this.round = 1
    this.currentDrawer = this.players[0].id
    this.currentWord = this.getRandomWord()
    this.drawingData = []

    return true
  }

  nextRound() {
    this.round++
    if (this.round > this.maxRounds) {
      this.gameState = 'finished'
      return false
    }

    const currentDrawerIndex = this.players.findIndex(
      (p) => p.id === this.currentDrawer
    )
    const nextDrawerIndex = (currentDrawerIndex + 1) % this.players.length
    this.currentDrawer = this.players[nextDrawerIndex].id
    this.currentWord = this.getRandomWord()
    this.drawingData = []

    return true
  }

  getRandomWord() {
    return words[Math.floor(Math.random() * words.length)]
  }

  addDrawingData(data) {
    this.drawingData.push(data)
  }

  clearDrawing() {
    this.drawingData = []
  }
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId)

    if (!games.has(roomId)) {
      games.set(roomId, new Game(roomId))
    }

    const game = games.get(roomId)
    game.addPlayer(socket.id, playerName)

    socket.emit('roomJoined', {
      roomId,
      players: game.players,
      gameState: game.gameState,
    })
    socket.to(roomId).emit('playerJoined', { playerId: socket.id, playerName })

    console.log(`${playerName} joined room ${roomId}`)
  })

  socket.on('startGame', ({ roomId }) => {
    const game = games.get(roomId)
    if (game && game.startGame()) {
      io.to(roomId).emit('gameStarted', {
        currentDrawer: game.currentDrawer,
        currentWord: game.currentWord,
        round: game.round,
        maxRounds: game.maxRounds,
      })
    }
  })

  socket.on('draw', ({ roomId, data }) => {
    const game = games.get(roomId)
    if (game && game.gameState === 'playing') {
      game.addDrawingData(data)
      socket.to(roomId).emit('drawing', data)
    }
  })

  socket.on('clearCanvas', ({ roomId }) => {
    const game = games.get(roomId)
    if (game) {
      game.clearDrawing()
      socket.to(roomId).emit('canvasCleared')
    }
  })

  socket.on('guess', ({ roomId, guess, playerName }) => {
    const game = games.get(roomId)
    if (
      game &&
      game.gameState === 'playing' &&
      game.currentWord.toLowerCase() === guess.toLowerCase()
    ) {
      // Correct guess
      game.scores[socket.id] += 10
      io.to(roomId).emit('correctGuess', {
        playerId: socket.id,
        playerName,
        guess,
      })

      // Move to next round
      if (game.nextRound()) {
        io.to(roomId).emit('nextRound', {
          currentDrawer: game.currentDrawer,
          currentWord: game.currentWord,
          round: game.round,
          scores: game.scores,
        })
      } else {
        // Game finished
        io.to(roomId).emit('gameFinished', {
          scores: game.scores,
          players: game.players,
        })
      }
    } else {
      // Wrong guess
      socket.to(roomId).emit('wrongGuess', { playerName, guess })
    }
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)

    // Remove player from all games they were in
    for (const [roomId, game] of games.entries()) {
      const player = game.players.find((p) => p.id === socket.id)
      if (player) {
        game.removePlayer(socket.id)
        socket
          .to(roomId)
          .emit('playerLeft', { playerId: socket.id, playerName: player.name })

        // If no players left, remove the game
        if (game.players.length === 0) {
          games.delete(roomId)
        }
      }
    }
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeGames: games.size })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Pictionary server running on port ${PORT}`)
  console.log(`Active games: ${games.size}`)
})
