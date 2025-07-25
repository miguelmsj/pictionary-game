import React, { useState, useEffect, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Svg, { Path } from 'react-native-svg'
import io, { Socket } from 'socket.io-client'

const { width, height } = Dimensions.get('window')
const CANVAS_WIDTH = width - 40
const CANVAS_HEIGHT = height * 0.5

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

// Import server configuration
const SERVER_CONFIG = require('./config/server')
const SERVER_URL = SERVER_CONFIG.SERVER_URL

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [guess, setGuess] = useState('')
  const [paths, setPaths] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [pathData, setPathData] = useState<
    { id: string; d: string; color: string; width: number }[]
  >([])
  const [currentPathData, setCurrentPathData] = useState<{
    id: string
    d: string
    color: string
    width: number
  } | null>(null)

  useEffect(() => {
    console.log('Connecting to server:', SERVER_URL)
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
      console.log('gameStarted event received:', data)
      setGameState((prev) => {
        const newState = prev ? { ...prev, ...data } : null
        console.log('Updated gameState:', newState)
        return newState
      })
      // Clear all drawing data when game starts
      setPaths([])
      setCurrentPath('')
      setPathData([])
      setCurrentPathData(null)
      addMessage('Game started!', 'info')
      if (data.currentDrawer === newSocket.id) {
        addMessage('You are the drawer! Draw: ' + data.currentWord, 'info')
        addMessage(`Canvas size: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, 'info')
      }
    })

    newSocket.on('nextRound', (data) => {
      console.log('nextRound event received:', data)
      setGameState((prev) => {
        const newState = prev ? { ...prev, ...data } : null
        console.log('Updated gameState after nextRound:', newState)
        return newState
      })
      // Clear all drawing data for the new round
      setPaths([])
      setCurrentPath('')
      setPathData([])
      setCurrentPathData(null)
      addMessage(`Round ${data.round} started!`, 'info')
    })

    newSocket.on('gameFinished', (data) => {
      setGameState((prev) =>
        prev ? { ...prev, gameState: 'finished', scores: data.scores } : null
      )
      addMessage('Game finished!', 'info')
    })

    newSocket.on('drawing', (data) => {
      // Add received drawing data to the pathData state for rendering
      setPathData((prev) => {
        const newPathData = [...prev]

        if (data.type === 'start') {
          // Start a new path
          newPathData.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            d: `M ${data.x} ${data.y}`,
            color: data.color || '#000',
            width: data.width || 2,
          })
        } else if (data.type === 'draw') {
          // Continue the current path
          if (newPathData.length > 0) {
            const lastPath = newPathData[newPathData.length - 1]
            lastPath.d = `${lastPath.d} L ${data.x} ${data.y}`
          }
        }

        return newPathData
      })
    })

    newSocket.on('canvasCleared', () => {
      setPaths([])
      setCurrentPath('')
      setPathData([])
      setCurrentPathData(null)
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

  const addMessage = (text: string, type: 'correct' | 'wrong' | 'info') => {
    const message: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      type,
    }
    setMessages((prev) => [...prev, message])
  }

  const joinRoom = () => {
    if (socket && playerName && roomId) {
      socket.emit('joinRoom', { roomId, playerName })
    } else {
      Alert.alert('Error', 'Please enter your name and room ID')
    }
  }

  const startGame = () => {
    if (socket && roomId) {
      socket.emit('startGame', { roomId })
    }
  }

  const handleGuess = () => {
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

  const handleTouchStart = (event: any) => {
    console.log('handleTouchStart called')
    console.log('gameState?.currentDrawer:', gameState?.currentDrawer)
    console.log('socket?.id:', socket?.id)
    console.log('isCurrentDrawer:', gameState?.currentDrawer === socket?.id)

    if (gameState?.currentDrawer === socket?.id) {
      console.log('Starting to draw...')
      setIsDrawing(true)
      const { locationX, locationY } = event.nativeEvent
      console.log('TouchStart:', locationX, locationY)
      const newPath = `M ${locationX} ${locationY}`
      setCurrentPath(newPath)
      setCurrentPathData({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        d: newPath,
        color: strokeColor,
        width: strokeWidth,
      })
      console.log('setCurrentPathData called with:', {
        d: newPath,
        color: strokeColor,
        width: strokeWidth,
      })
      if (socket && roomId) {
        socket.emit('draw', {
          roomId,
          data: {
            type: 'start',
            x: locationX,
            y: locationY,
            color: strokeColor,
            width: strokeWidth,
          },
        })
      }
    } else {
      console.log('Not the current drawer or missing gameState/socket')
    }
  }

  const handleTouchMove = (event: any) => {
    if (isDrawing && gameState?.currentDrawer === socket?.id) {
      const { locationX, locationY } = event.nativeEvent
      setCurrentPath((prev) => `${prev} L ${locationX} ${locationY}`)
      setCurrentPathData((prev) => {
        const newData = prev
          ? { ...prev, d: `${prev.d} L ${locationX} ${locationY}` }
          : null
        return newData
      })
      if (socket && roomId) {
        socket.emit('draw', {
          roomId,
          data: {
            type: 'draw',
            x: locationX,
            y: locationY,
            color: strokeColor,
            width: strokeWidth,
          },
        })
      }
    }
  }

  const handleTouchEnd = () => {
    if (isDrawing) {
      setIsDrawing(false)
      if (currentPath && currentPathData) {
        setPaths((prev) => [...prev, currentPath])
        setPathData((prev) => [...prev, currentPathData])
        setCurrentPath('')
        setCurrentPathData(null)
      }
    }
  }

  const isCurrentDrawer = gameState?.currentDrawer === socket?.id

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pictionary Game</Text>
        <Text>Connecting to server...</Text>
      </View>
    )
  }

  if (!gameState) {
    return (
      <View style={styles.container}>
        <View style={styles.joinContainer}>
          <Text style={styles.title}>Pictionary Game</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={playerName}
            onChangeText={setPlayerName}
          />
          <TextInput
            style={styles.input}
            placeholder="Room ID"
            value={roomId}
            onChangeText={setRoomId}
          />
          <TouchableOpacity style={styles.button} onPress={joinRoom}>
            <Text style={styles.buttonText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        scrollEnabled={!isDrawing}
      >
        <Text style={styles.title}>Pictionary Game</Text>

        <View style={styles.gameInfoTitle}>
          <Text style={styles.roomText}>Room: {gameState.roomId}</Text>
          <ScrollView horizontal style={styles.playersList}>
            {gameState.players.map((player) => (
              <View
                key={player.id}
                style={[
                  styles.player,
                  player.id === gameState.currentDrawer && styles.currentDrawer,
                ]}
              >
                <Text
                  style={[
                    styles.playerText,
                    player.id === gameState.currentDrawer &&
                      styles.currentDrawerText,
                  ]}
                >
                  {player.name}{' '}
                  {player.id === gameState.currentDrawer ? '(Drawing)' : ''}
                </Text>
              </View>
            ))}
          </ScrollView>

          {gameState.scores && (
            <ScrollView horizontal style={styles.scores}>
              {gameState.players.map((player) => (
                <View key={player.id} style={styles.scoreItem}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.scoreValue}>
                    {gameState.scores![player.id] || 0}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {gameState.round && (
            <Text style={styles.roundText}>
              Round {gameState.round} of {gameState.maxRounds}
            </Text>
          )}
        </View>

        {gameState.gameState === 'waiting' && (
          <View style={styles.gameContainer}>
            <Text style={{ marginBottom: 10 }}>
              Waiting for players... ({gameState.players.length} players)
            </Text>
            {gameState.players.length >= 2 && (
              <TouchableOpacity style={styles.button} onPress={startGame}>
                <Text style={styles.buttonText}>Start Game</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {gameState.gameState === 'playing' && (
          <View style={styles.gameContainer}>
            {isCurrentDrawer ? (
              <Text style={styles.wordDisplay}>
                Draw: {gameState.currentWord}
              </Text>
            ) : (
              <Text style={styles.wordDisplay}>Guess the word!</Text>
            )}

            <View style={styles.canvasContainer}>
              {isCurrentDrawer && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  {[
                    '#000000',
                    '#FF0000',
                    '#00FF00',
                    '#0000FF',
                    '#FFFF00',
                    '#FF00FF',
                    '#00FFFF',
                  ].map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setStrokeColor(color)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: color,
                        marginHorizontal: 5,
                        borderWidth: strokeColor === color ? 3 : 1,
                        borderColor: strokeColor === color ? '#333' : '#ccc',
                      }}
                    />
                  ))}
                </View>
              )}

              <View style={styles.canvasWrapper}>
                <View
                  style={[
                    styles.canvas,
                    { backgroundColor: 'rgba(255,255,255,0.1)' },
                  ]}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <Svg
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    onPress={() => console.log('SVG pressed!')}
                  >
                    {pathData.map((path) => (
                      <Path
                        key={path.id}
                        d={path.d}
                        stroke={path.color}
                        strokeWidth={path.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {currentPathData && (
                      <Path
                        d={currentPathData.d}
                        stroke={currentPathData.color}
                        strokeWidth={currentPathData.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                </View>
              </View>
            </View>

            <View style={styles.controls}>
              {isCurrentDrawer && (
                <TouchableOpacity
                  style={[styles.button, styles.clearButton]}
                  onPress={clearCanvas}
                >
                  <Text style={styles.buttonText}>Clear Canvas</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isCurrentDrawer && (
              <View style={styles.guessInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your guess..."
                  value={guess}
                  onChangeText={setGuess}
                />
                <TouchableOpacity style={styles.button} onPress={handleGuess}>
                  <Text style={styles.buttonText}>Guess</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {gameState.gameState === 'finished' && (
          <View style={styles.gameContainer}>
            <Text style={styles.title}>Game Finished!</Text>
            <ScrollView horizontal style={styles.scores}>
              {gameState.players.map((player) => (
                <View key={player.id} style={styles.scoreItem}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.scoreValue}>
                    {gameState.scores![player.id] || 0}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.messages}>
          <Text style={styles.messagesTitle}>Messages</Text>
          <ScrollView style={styles.messagesList}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[styles.message, styles[`message${message.type}`]]}
              >
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 50,
  },
  joinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gameInfoTitle: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roomText: {
    fontSize: 16,
    borderRadius: 8,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playersList: {
    marginBottom: 10,
  },
  player: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  currentDrawer: {
    backgroundColor: '#007bff',
  },
  playerText: {
    fontSize: 14,
  },
  currentDrawerText: {
    color: 'white',
  },
  scores: {
    marginTop: 10,
  },
  scoreItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  playerName: {
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
  },
  roundText: {
    marginTop: 10,
    textAlign: 'center',
  },
  gameContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  wordDisplay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    textAlign: 'center',
  },
  canvasContainer: {
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    marginVertical: 8,
    paddingTop: 8,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  canvasLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 10,
  },
  canvasDebug: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  canvasWrapper: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    marginTop: 16,
  },
  guessInput: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 15,
    width: '100%',
    maxWidth: 300,
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messages: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  messagesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  messagesList: {
    flex: 1,
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
  },
  messagecorrect: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  messagewrong: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
  },
  messageinfo: {
    backgroundColor: '#d1ecf1',
    borderColor: '#bee5eb',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
  },
})
