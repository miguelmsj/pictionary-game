import React, { useState, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'

interface Player {
  id: string
  name: string
}

interface GameState {
  roomId: string
  players: Player[]
  gameState: 'waiting' | 'playing' | 'finished'
  currentDrawer?: string
  currentWord?: string
  round?: number
  maxRounds?: number
  scores?: Record<string, number>
}

interface Message {
  id: string
  text: string
  type: 'correct' | 'wrong' | 'info'
}

const SERVER_URL = 'http://localhost:3001'

function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [guess, setGuess] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingData, setDrawingData] = useState<any[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const newSocket = io(SERVER_URL)
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      addMessage('Connected to server', 'info')
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      addMessage('Disconnected from server', 'info')
    })

    newSocket.on('roomJoined', (data) => {
      setGameState((prev) => {
        // If we already have a game state and the game is in progress,
        // only update the players list, not the entire game state
        if (prev && prev.gameState === 'playing') {
          return { ...prev, players: data.players }
        }
        return data
      })
      addMessage(`Joined room ${data.roomId}`, 'info')
    })

    newSocket.on('playerJoined', (data) => {
      addMessage(`${data.playerName} joined the game`, 'info')
    })

    newSocket.on('playerLeft', (data) => {
      addMessage(`${data.playerName} left the game`, 'info')
    })

    newSocket.on('gameStarted', (data) => {
      setGameState((prev) => (prev ? { ...prev, ...data } : null))
      addMessage('Game started!', 'info')
    })

    newSocket.on('nextRound', (data) => {
      setGameState((prev) => (prev ? { ...prev, ...data } : null))
      setDrawingData([])
      addMessage(`Round ${data.round} started!`, 'info')
    })

    newSocket.on('gameFinished', (data) => {
      setGameState((prev) =>
        prev ? { ...prev, gameState: 'finished', scores: data.scores } : null
      )
      addMessage('Game finished!', 'info')
    })

    newSocket.on('drawing', (data) => {
      setDrawingData((prev) => {
        const newData = [...prev, data]

        return newData
      })
    })

    newSocket.on('canvasCleared', () => {
      setDrawingData([])
      if (contextRef.current) {
        contextRef.current.clearRect(0, 0, 600, 400)
      }
    })

    newSocket.on('correctGuess', (data) => {
      addMessage(
        `${data.playerName} correctly guessed "${data.guess}"!`,
        'correct'
      )
    })

    newSocket.on('wrongGuess', (data) => {
      addMessage(`${data.playerName} guessed "${data.guess}" - wrong!`, 'wrong')
    })

    return () => {
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (context) {
        context.strokeStyle = '#000'
        context.lineWidth = 2
        context.lineCap = 'round'
        contextRef.current = context
      }
    }
  }, [gameState?.gameState]) // Re-run when game state changes to ensure canvas is rendered

  useEffect(() => {
    if (contextRef.current && drawingData.length > 0) {
      const context = contextRef.current
      // Clear the canvas first
      context.clearRect(0, 0, 600, 400)

      // Process all drawing data to render the complete drawing
      drawingData.forEach((data) => {
        const { x, y, color, width, type } = data

        if (type === 'start') {
          context.strokeStyle = color || '#000'
          context.lineWidth = width || 2
          context.beginPath()
          context.moveTo(x, y)
        } else if (type === 'draw') {
          context.strokeStyle = color || '#000'
          context.lineWidth = width || 2
          context.lineTo(x, y)
          context.stroke()
        }
      })
    }
  }, [drawingData])

  const addMessage = (text: string, type: 'correct' | 'wrong' | 'info') => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      type,
    }
    setMessages((prev) => [...prev, message])
  }

  const joinRoom = () => {
    if (socket && playerName && roomId) {
      socket.emit('joinRoom', { roomId, playerName })
    }
  }

  const startGame = () => {
    if (socket && roomId) {
      socket.emit('startGame', { roomId })
    }
  }

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault()
    if (socket && roomId && guess.trim()) {
      socket.emit('guess', { roomId, guess: guess.trim(), playerName })
      setGuess('')
    }
  }

  const clearCanvas = () => {
    if (socket && roomId) {
      socket.emit('clearCanvas', { roomId })
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState?.currentDrawer || gameState.currentDrawer !== socket?.id)
      return

    setIsDrawing(true)
    isDrawingRef.current = true
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (contextRef.current) {
        contextRef.current.beginPath()
        contextRef.current.moveTo(x, y)
      }

      if (socket && roomId) {
        socket.emit('draw', {
          roomId,
          data: {
            type: 'start',
            x,
            y,
            color: contextRef.current?.strokeStyle || '#000',
            width: contextRef.current?.lineWidth || 2,
          },
        })
      }
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      !isDrawingRef.current ||
      !gameState?.currentDrawer ||
      gameState.currentDrawer !== socket?.id
    )
      return

    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (contextRef.current) {
        contextRef.current.lineTo(x, y)
        contextRef.current.stroke()
      }

      if (socket && roomId) {
        socket.emit('draw', {
          roomId,
          data: {
            type: 'draw',
            x,
            y,
            color: contextRef.current?.strokeStyle || '#000',
            width: contextRef.current?.lineWidth || 2,
          },
        })
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    isDrawingRef.current = false
  }

  const isCurrentDrawer = gameState?.currentDrawer === socket?.id

  if (!isConnected) {
    return (
      <div className="container">
        <h1>Pictionary Game</h1>
        <p>Connecting to server...</p>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="container">
        <h1>Pictionary Game</h1>
        <div className="input-group">
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="input"
          />
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="input"
          />
          <button onClick={joinRoom} className="btn btn-primary">
            Join Room
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Pictionary Game</h1>

      <div className="game-info">
        <h3>Room: {gameState.roomId}</h3>
        <div className="players-list">
          {gameState.players.map((player) => (
            <span
              key={player.id}
              className={`player ${
                player.id === gameState.currentDrawer ? 'current-drawer' : ''
              }`}
            >
              {player.name}{' '}
              {player.id === gameState.currentDrawer ? '(Drawing)' : ''}
            </span>
          ))}
        </div>

        {gameState.scores && (
          <div className="scores">
            {gameState.players.map((player) => (
              <div key={player.id} className="score-item">
                <div>{player.name}</div>
                <div className="score-value">
                  {gameState.scores![player.id] || 0}
                </div>
              </div>
            ))}
          </div>
        )}

        {gameState.round && (
          <div>
            Round {gameState.round} of {gameState.maxRounds}
          </div>
        )}
      </div>

      {gameState.gameState === 'waiting' && (
        <div className="waiting-container">
          <p>Waiting for players... ({gameState.players.length} players)</p>
          {gameState.players.length >= 2 && (
            <button onClick={startGame} className="btn btn-primary">
              Start Game
            </button>
          )}
        </div>
      )}

      {gameState.gameState === 'playing' && (
        <div className="game-container">
          {isCurrentDrawer ? (
            <div className="word-display">
              Draw: {gameState.currentWord}
              {isDrawing && (
                <span style={{ color: '#ff6b6b', marginLeft: '10px' }}>
                  ● Drawing...
                </span>
              )}
            </div>
          ) : (
            <div className="word-display">Guess the word!</div>
          )}

          <div className="canvas-container">
            {isCurrentDrawer && (
              <div className="color-picker">
                {[
                  '#000000',
                  '#FF0000',
                  '#00FF00',
                  '#0000FF',
                  '#FFFF00',
                  '#FF00FF',
                  '#00FFFF',
                ].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      if (contextRef.current) {
                        contextRef.current.strokeStyle = color
                      }
                    }}
                    className="color-button"
                    style={{
                      backgroundColor: color,
                      border:
                        contextRef.current?.strokeStyle === color
                          ? '3px solid #333'
                          : '1px solid #ccc',
                    }}
                    title={`Select ${color}`}
                  />
                ))}
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="canvas"
              style={{
                border: isDrawing ? '3px solid #ff6b6b' : '2px solid #333',
                backgroundColor: '#fff',
                display: 'block',
                cursor: 'crosshair',
                transition: 'border-color 0.2s ease',
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>

          <div className="controls">
            {isCurrentDrawer && (
              <>
                <button onClick={clearCanvas} className="btn btn-danger">
                  Clear Canvas
                </button>
                {isDrawing && (
                  <span
                    style={{
                      color: '#ff6b6b',
                      marginLeft: '15px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    🎨 Drawing in progress...
                  </span>
                )}
              </>
            )}
          </div>

          {!isCurrentDrawer && (
            <form onSubmit={handleGuess} className="guess-input">
              <input
                type="text"
                placeholder="Enter your guess..."
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Guess
              </button>
            </form>
          )}
        </div>
      )}

      {gameState.gameState === 'finished' && (
        <div className="game-container">
          <h2>Game Finished!</h2>
          <div className="scores">
            {gameState.players.map((player) => (
              <div key={player.id} className="score-item">
                <div>{player.name}</div>
                <div className="score-value">
                  {gameState.scores![player.id] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="messages">
        <h3>Messages</h3>
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {message.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
