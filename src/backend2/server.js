const { WebSocketServer } = require("ws");
const GameManager = require('./GameManager.js');

const wss = new WebSocketServer({ port: 8080 });
console.log("Server started at port 8080")
const gameManager = new GameManager();
let numberOfConnections = 0;
wss.on('connection', (ws) => {
    numberOfConnections += 1;
    console.log(numberOfConnections);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === "init_game") {
                gameManager.addPlayer(ws);
            }
            else if (message.type === "create_invite") {
                const inviteCode = gameManager.createInvite(ws);
                inviteCode && ws.send(JSON.stringify({type: "invite_code", code: inviteCode}));
            }
            else if (message.type === "join_with_code" && message.inviteCode) gameManager.addPlayer(ws, message.inviteCode);
        }
        catch(e) {
            console.error("Error parsing message:", e);
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
    })
    ws.on('close', () => {
        gameManager.removePlayer(ws)
        numberOfConnections -= 1;
        console.log("Disconnected");
        console.log(numberOfConnections);
    });
});

// remove player feature
// invite code expiration