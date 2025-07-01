# 🎨 Pictionary Game

A real-time multiplayer Pictionary game where mobile users can play with web users in the same room. Built with React Native (Expo), React, and Node.js with Socket.io for real-time communication.

## 🏗️ Project Structure

```
pictionary-game/
├── server/           # Node.js/Express backend with Socket.io
├── web/             # React web client with HTML5 Canvas
├── mobile/          # Expo React Native app with SVG drawing
└── README.md        # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install web client dependencies
cd ../web
npm install

# Install mobile app dependencies
cd ../mobile
npm install
```

### 2. Start the Server

```bash
cd server
npm start
```

The server will run on `http://localhost:3001`

### 3. Start the Web Client

```bash
cd web
npm start
```

The web app will run on `http://localhost:3000`

### 4. Start the Mobile App

```bash
cd mobile
npm start
```

Use iOS/Android simulator or follow the phone testing guide below.

## 📱 Phone Testing Guide

### Prerequisites

1. **Expo Go App**: Install Expo Go on your phone from the App Store (iOS) or Google Play Store (Android)
2. **Same WiFi Network**: Your phone and computer must be on the same WiFi network
3. **Server Running**: Make sure the server is running on your computer

### Step 1: Find Your Computer's IP Address

Run this command in the `mobile` directory:

```bash
node scripts/find-ip.js
```

This will show you your computer's IP address (e.g., `192.168.1.100`).

### Step 2: Update Server Configuration

Update the server configuration with your IP address:

```bash
node scripts/update-ip.js <your-ip-address>
```

For example:

```bash
node scripts/update-ip.js 192.168.1.100
```

This automatically updates `mobile/config/server.js` with the correct IP.

### Step 3: Start the Server

In the `server` directory, start the server:

```bash
npm start
```

The server should be running on `http://<your-ip>:3001`

### Step 4: Start the Mobile App

In the `mobile` directory, start the Expo development server:

```bash
npm start
```

### Step 5: Connect with Expo Go

1. Open Expo Go on your phone
2. Scan the QR code displayed in your terminal
3. The app should load and connect to your server

### Troubleshooting

#### Connection Issues

If the app can't connect to the server:

1. **Check IP Address**: Make sure you're using the correct IP address
2. **Check WiFi**: Ensure both devices are on the same network
3. **Check Firewall**: Your computer's firewall might be blocking the connection
4. **Check Server**: Make sure the server is running on port 3001

#### Manual Configuration

If the automatic scripts don't work, manually edit `mobile/config/server.js`:

```javascript
const SERVER_CONFIG = {
  SERVER_URL: 'http://YOUR_IP_ADDRESS:3001', // Replace with your IP
  PORT: 3001,
}
```

#### Testing with Web Client

You can also test with the web client by opening `http://localhost:3000` in your browser while the mobile app is connected.

## 🎮 Game Features

- ✅ **Real-time drawing synchronization** between mobile and web
- ✅ **Color selection** on both platforms
- ✅ **Turn-based gameplay** with automatic drawer rotation
- ✅ **Word guessing** with real-time feedback
- ✅ **Score tracking** across rounds
- ✅ **Multiplayer support** with room-based gameplay
- ✅ **Player list updates** in real-time
- ✅ **Game state synchronization**
- ✅ **Drawing data transmission** via WebSocket

## 🛠️ Technology Stack

- **Backend**: Node.js + Express + Socket.io
- **Web Frontend**: React + TypeScript + HTML5 Canvas + Socket.io client
- **Mobile**: Expo + React Native + react-native-svg + Socket.io client
- **Real-time Communication**: Socket.io
- **Drawing**: SVG (mobile) + Canvas (web)

## 🔧 Development

Each project can be developed independently. The server handles all game logic and real-time communication between clients.

### Key Components

- **Server**: Manages game state, player connections, and drawing data
- **Web Client**: HTML5 Canvas-based drawing with real-time sync
- **Mobile Client**: SVG-based drawing optimized for touch interactions

### Architecture

```
┌─────────────┐    WebSocket    ┌─────────────┐
│   Mobile    │ ◄──────────────► │   Server    │
│   Client    │                 │             │
└─────────────┘                 └─────────────┘
       ▲                              ▲
       │                              │
       │ WebSocket                    │ WebSocket
       │                              │
┌─────────────┐                 ┌─────────────┐
│    Web      │ ◄──────────────► │   Server    │
│   Client    │                 │             │
└─────────────┘                 └─────────────┘
```

## 📋 Features to Test

- ✅ Real-time drawing between mobile and web
- ✅ Color selection on both platforms
- ✅ Player list updates
- ✅ Game state synchronization
- ✅ Drawing data transmission
- ✅ Room creation and joining
- ✅ Turn-based gameplay
- ✅ Score tracking
- ✅ Word guessing system

## 📝 Notes

- The mobile app uses `react-native-svg` for drawing
- The web app uses HTML5 Canvas
- Both platforms sync drawing data in real-time via WebSocket
- Color picker is only visible to the current drawer
- The app automatically handles network configuration for phone testing
- All drawing data is synchronized in real-time between all connected clients

## 🚀 Deployment

The project is designed for local development and testing. For production deployment:

1. Deploy the server to a cloud platform (Heroku, AWS, etc.)
2. Update the client configurations to point to the production server
3. Build the mobile app for app store distribution
4. Deploy the web client to a static hosting service

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on both mobile and web
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.
