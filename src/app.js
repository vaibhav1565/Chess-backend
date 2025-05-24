require("dotenv").config()

const express = require("express");
const http = require("node:http");
const cookieParser = require("cookie-parser");
const cors = require("cors")
const { WebSocketServer } = require("ws");

const connectDB = require("./config/database.js");
const GameManager = require("./GameManager.js");
const { handleConnection } = require("./websocket/websocketHandler.js");

const authRouter = require("./routes/auth.js");
const profileRouter = require("./routes/profile.js");
const guestAuthRouter = require('./routes/guest.js');

const app = express();
app.use(cors(
  {
    origin: 'http://localhost:5173',
    credentials: true
  }
))
app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);
app.use('/', guestAuthRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const gameManager = new GameManager();

wss.on('connection', (ws, req) => handleConnection(ws, req, gameManager));

// Start the database connection and server
connectDB()
  .then(() => {
    console.log("Database connection established...");
    server.listen(3000, () => {
      console.log("Server is successfully listening on port 3000...");
    });
  })
  .catch((e) => {
    console.error("Database cannot be connected!!", e);
  });