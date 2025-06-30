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
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import io, { Socket } from 'socket.io-client'

const { width, height } = Dimensions.get('window')
const CANVAS_WIDTH = width - 40
const CANVAS_HEIGHT = height * 0.4

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

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

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
      setGameState(data)
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
      setPaths([])
      addMessage(`Round ${data.round} started!`, 'info')
    })

    newSocket.on('gameFinished', (data) => {
      setGameState((prev) =>
        prev ? { ...prev, gameState: 'finished', scores: data.scores } : null
      )
      addMessage('Game finished!', 'info')
    })

    newSocket.on('drawing', (data) => {
      if (data.type === 'start') {
        setCurrentPath(`M ${data.x} ${data.y}`)
      } else if (data.type === 'draw') {
        setCurrentPath((prev) => `${prev} L ${data.x} ${data.y}`)
      }
    })

    newSocket.on('canvasCleared', () => {
      setPaths([])
      setCurrentPath('')
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
      id: Date.now().toString(),
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

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startX = translateX.value
      context.startY = translateY.value
    },
    onActive: (event, context) => {
      if (gameState?.currentDrawer === socket?.id) {
        translateX.value = context.startX + event.translationX
        translateY.value = context.startY + event.translationY

        const x = event.absoluteX - 20 // Adjust for padding
        const y = event.absoluteY - 200 // Adjust for header

        if (x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT) {
          if (event.state === State.BEGAN) {
            runOnJS(setCurrentPath)(`M ${x} ${y}`)
            socket?.emit('draw', { roomId, data: { type: 'start', x, y } })
          } else {
            runOnJS(setCurrentPath)((prev) => `${prev} L ${x} ${y}`)
            socket?.emit('draw', { roomId, data: { type: 'draw', x, y } })
          }
        }
      }
    },
    onEnd: () => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath])
        setCurrentPath('')
      }
    },
  })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }
  })

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
    )
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Pictionary Game</Text>

      <View style={styles.gameInfo}>
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
          <Text>
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
            <PanGestureHandler onGestureEvent={gestureHandler}>
              <Animated.View style={[styles.canvas, animatedStyle]}>
                <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                  {paths.map((path, index) => (
                    <Path
                      key={index}
                      d={path}
                      stroke="black"
                      strokeWidth={2}
                      fill="none"
                    />
                  ))}
                  {currentPath && (
                    <Path
                      d={currentPath}
                      stroke="black"
                      strokeWidth={2}
                      fill="none"
                    />
                  )}
                </Svg>
              </Animated.View>
            </PanGestureHandler>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roomText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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
    marginBottom: 20,
  },
  canvasContainer: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  controls: {
    flexDirection: 'row',
    marginTop: 20,
  },
  guessInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: 'white',
    marginRight: 10,
    flex: 1,
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
