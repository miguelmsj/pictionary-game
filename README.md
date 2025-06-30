# Pictionary Game

A real-time multiplayer Pictionary game where mobile users can play with web users.

## Project Structure

```
pictionary-game/
├── server/           # Node.js/Express backend with Socket.io
├── web/             # React web client
├── mobile/          # Expo React Native app
└── README.md        # This file
```

## Quick Start

### 1. Start the Server

```bash
cd server
npm install
npm start
```

The server will run on `http://localhost:3001`

### 2. Start the Web Client

```bash
cd web
npm install
npm start
```

The web app will run on `http://localhost:3000`

### 3. Start the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go app on your phone.

## Game Features

- Real-time drawing synchronization
- Turn-based gameplay
- Word guessing
- Score tracking
- Multiplayer support

## Technology Stack

- **Backend**: Node.js + Express + Socket.io
- **Web Frontend**: React + TypeScript + Socket.io client
- **Mobile**: Expo + React Native + Socket.io client
- **Real-time Communication**: Socket.io

## Environment Variables

Copy `.env.example` to `.env` in each directory and configure as needed.

## Development

Each project can be developed independently. The server handles all game logic and real-time communication between clients.
