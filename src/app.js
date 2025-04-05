require("dotenv").config()

const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("node:http");
const { WebSocketServer } = require("ws");
const cookieParser = require("cookie-parser");
const cors = require("cors")
// const session = require("express-session");
// const passport = require("./config/passport");
// const helmet = require("helmet");

const connectDB = require("./config/database.js");

const authRouter = require("./routes/auth.js");
const profileRouter = require("./routes/profile.js");
const guestAuthRouter = require('./routes/guest.js');
// const googleAuthRouter = require("./routes/googleAuth");


const User = require("./models/user");

const GameManager = require("./GameManager.js");
const { INIT_GAME, CREATE_INVITE_CODE } = require("./messages.js");

const app = express();
app.use(cors(
  {
    origin: 'http://localhost:5173',
    credentials: true
  }
))
app.use(express.json());
app.use(cookieParser());

// app.use(
//   session({
//     secret: "secret_key",
//     resave: false,
//     saveUninitialized: true,
//   })
// );
// app.use(passport.initialize());
// app.use(passport.session());
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         scriptSrc: ["'self'", "https://accounts.google.com", "'unsafe-inline'", "'unsafe-eval'"],
//         frameSrc: ["https://accounts.google.com"],  // Allow Google login popups
//       },
//     },
//   })
// );

app.use("/", authRouter);
app.use('/', guestAuthRouter);
app.use("/", profileRouter);
// app.use("/", googleAuthRouter);

const server = http.createServer(app); // Create an HTTP server

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({
  server,
  path: '/ws' // Define a specific path for WebSocket connections
}); 
const gameManager = new GameManager();

let numberOfConnections = 0;

wss.on('connection', async (ws, req) => {
    try {
      const params = new URLSearchParams(req.url.split('?')[1]);
      const token = params.get('token');
      if (!token) {
        throw new Error("Token is not valid");
      }

      const decodedObj = jwt.verify(token, process.env.SECRET_KEY);

      const { _id } = decodedObj;
      const user = await User.findById(_id);
      if (!user) {
        throw new Error("User not found");
      }

      ws.user = user;
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({success: true}));

      numberOfConnections += 1;
      console.log("Connected", numberOfConnections);
      console.log(ws.user.username);
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
        console.log("Disconnected", numberOfConnections);
      });
    }
    catch (e) {
      ws.close();
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