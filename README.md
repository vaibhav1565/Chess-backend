# ♟️ Chess Game Backend

This is the backend for the Chess game built using the **MERN stack** with **real-time WebSocket communication**. It handles user authentication, multiplayer matchmaking and game logic coordination.

## 🚀 Features

- User authentication (Sign up, Login, Play as Guest)
- Multiplayer matchmaking with:
  - Random opponent or Invite Code
  - Draw offer/accept/reject
  - Real-time chat and timers
- AI play using **Stockfish**
- Undo, Resign features
- Chess move validation using `chess.js`
- Real-time communication using `ws`
- User and input validation throughout

## 🛠️ Tech Stack

- Node.js
- Express
- MongoDB
- WebSocket (`ws`)
- chess.js

## 📁 Project Structure
```
├── README.md
├── package-lock.json
├── package.json
└── src
    ├── Game.js
    ├── GameManager.js
    ├── app.js
    ├── chessConstants.js
    ├── config
    ├── middlewares
    ├── models
    ├── routes
    ├── utils
    └── websocket
```


## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-backend-repo-url>
cd chess-backend
```

### 2. Install Dependencies
```bash
npm ci
```

### 3. Create a .env file
Create a .env file in the root directory with the following content:

SECRET_KEY=your_secret_key_here

MONGODB_CONNECTION_STRING=your_mongodb_connection_string_here

### 4. Start the server
```bash
npm run dev
```