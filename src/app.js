const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("http");
const { WebSocketServer } = require("ws");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/database.js");
const User = require("./models/user");
const authRouter = require("./routes/auth.js");
const profileRouter = require("./routes/profile.js");

const GameManager = require("./GameManager.js");
const { INIT_GAME } = require("./messages.js");

const app = express();
const server = http.createServer(app); // Create an HTTP server

app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({ server });
const gameManager = new GameManager();
let numberOfConnections = 0;

wss.on('connection', async (ws, req) => {
  const token = req.url.split("token=")[1]; // Extract token from URL
  console.log(token);
  if (!token) {
    throw new Error("Token is not valid");
  }

  try {
    const decodedObj = jwt.verify(token, process.env.SECRET_KEY);

    const { _id } = decodedObj;
    const user = await User.findById(_id);
    console.log(user);
    if (!user) {
      throw new Error("User not found");
    }

    ws.user = user; // Attach user info to the WebSocket instance

    numberOfConnections += 1;
    console.log(numberOfConnections);

    ws.on('message', (message) => {
      message = JSON.parse(message.toString());
      
      if (message.type === INIT_GAME) {
        gameManager.addPlayer(ws);
      }
      else if (message.type === "create_invite_code") {
        const inviteCode = gameManager.createInvite(ws);
        inviteCode && ws.send(JSON.stringify({ type: "invite_code", code: inviteCode }));
      }
      else if (message.type === "delete_invite_code") {
        gameManager.deleteInvite(ws);
      }
      else if (message.type === "join_with_invite_code" && message.inviteCode) {
        gameManager.addPlayer(ws, message.inviteCode);
      }
    });

    ws.on('close', () => {
      gameManager.removePlayer(ws);
      numberOfConnections -= 1;
      console.log("Disconnected");
      console.log(numberOfConnections);
    });
  } 
  catch (e) {
    console.log(e);
    ws.close();
  }
});

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