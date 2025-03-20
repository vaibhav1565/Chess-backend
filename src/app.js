const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("node:http");
const { WebSocketServer } = require("ws");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/database.js");

const authRouter = require("./routes/auth.js");
const profileRouter = require("./routes/profile.js");
const guestAuthRouter = require('./routes/guest.js');

const User = require("./models/user");

const GameManager = require("./GameManager.js");
const { INIT_GAME, CREATE_INVITE_CODE } = require("./messages.js");

require("dotenv").config()
const app = express();
const server = http.createServer(app); // Create an HTTP server

app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);
app.use('/', guestAuthRouter);
app.use("/", profileRouter);

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({ server });
const gameManager = new GameManager();

let numberOfConnections = 0;

wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const token = params.get('token');
    if (!token) {
      throw new Error("Token is not valid");
    }

    try {
      const decodedObj = jwt.verify(token, process.env.SECRET_KEY);

      const { _id } = decodedObj;
      const user = await User.findById(_id);
      if (!user) {
        throw new Error("User not found");
      }

      ws.user = user; // Attach user info to the WebSocket instance
      ws.readyState === ws.OPEN && ws.send(JSON.stringify({success: true}));

      numberOfConnections += 1;
      console.log(numberOfConnections);
      ws.on('message', async (message) => {
        try {
          // console.log(ws.user);

          message = JSON.parse(message.toString());
          const { minutes, inviteCode } = message?.payload;

          switch (message.type) {
            case INIT_GAME: {
              if (inviteCode) {
                gameManager.addPlayer(ws, inviteCode, undefined);
              }
              else if (minutes) {
                gameManager.addPlayer(ws, undefined, minutes);
              }
              break;
            }
            case CREATE_INVITE_CODE: {
              if (minutes) {
                gameManager.createInvite(ws, minutes);
              }
              break;
            }
          }
        }
        catch (e) {
          console.log("ERROR", e);
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
      console.log("ERROR", e);
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