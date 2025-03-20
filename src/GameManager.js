const Game = require("./Game.js");
const { v4: uuidv4 } = require('uuid');
const { OPPONENT_DISCONNECT } = require("./messages.js");

class GameManager {
    constructor() {
        this.waitingUser = {
            1: null,
            3: null,
            10: null,
            30: null
        };
        this.games = [];
        this.invites = {}; 
        
        /* Store invite codes: 
            { code: 
                {ws: player, minutes} }
        */

    }

    removeGame(gameIndex) {
        this.games.splice(gameIndex, 1);
    }

    findGameByPlayer(ws) {
        const { _id } = ws.user;
        return this.games.findIndex(game => game.player1.user._id.equals(_id) || game.player2.user._id.equals(_id));
    }

    addPlayer(ws, inviteCode, minutes) {
        if (minutes) {
            if (! (minutes === 1 || minutes === 3 || minutes === 10 || minutes === 30)) return;
        }
        // console.log('addPlayer function 1')
        
        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex > -1) {
            const game = this.games[gameIndex];
            const { _id } = ws.user;
            const playerColor = game.player1.user._id.equals(_id) ? 'w' : 'b';
            if (game.connectionStatus[playerColor] === 'disconnected') {
                this.reconnectPlayer(ws, game);
            }
            return;
        }

        if (inviteCode) {
            if (this.invites[inviteCode]) {
                const otherPlayer = this.invites[inviteCode]['ws'];
                if (otherPlayer.user._id.equals(ws.user._id)) return;

                const minutes = this.invites[inviteCode]['minutes'];
                const newGame = new Game(otherPlayer, ws, this, minutes);
                this.games.push(newGame);
                this.attachMessageHandler(otherPlayer);
                this.attachMessageHandler(ws);

                delete this.invites[inviteCode];
            }
            else {
                ws.send(JSON.stringify({ type: "error", message: "Invalid invite code" }));
            }
        }
        else {
            // console.log('addPlayer function 2')
            if (!this.waitingUser[minutes] || this.waitingUser[minutes].readyState !== this.waitingUser[minutes].OPEN) {
                this.waitingUser[minutes] = null;
            }
            if (!this.waitingUser[minutes]) {
                this.waitingUser[minutes] = ws;
                ws.send(JSON.stringify({ type: "message", message: "Waiting for another player to join" }))
            } else {
                if (this.waitingUser[minutes].user._id.equals(ws.user._id)) {
                    console.log(this.waitingUser[minutes].user._id);
                    console.log(ws.user._id);
                    return;
                }
                const newGame = new Game(this.waitingUser[minutes], ws, this, minutes);
                this.games.push(newGame);
                this.attachMessageHandler(this.waitingUser[minutes]);
                this.attachMessageHandler(ws);

                this.waitingUser[minutes] = null;
                // console.log('addPlayer function 3')
            }
        }
    }

    createInvite(ws, minutes) {
        if (!(minutes === 1 || minutes === 3 || minutes === 10 || minutes === 30)) return;

        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex > -1) {
            const game = this.games[gameIndex];
            const { _id } = ws.user;
            const playerColor = game.player1.user._id.equals(_id) ? 'w' : 'b';
            if (game.connectionStatus[playerColor] === 'disconnected') {
                this.reconnectPlayer(ws, game);
            }
            return;
        }

        // todo: make a function for reusability

        const inviteCode = uuidv4().slice(0, 6);
        this.invites[inviteCode] = { ws, minutes };
        setTimeout(() => { delete this.invites[inviteCode]; }, 15 * 60 * 1000); // Expires after 15 minutes

        ws.send(JSON.stringify({ code: inviteCode }));
    }

    removePlayer(ws) {
        for (let timeControl in this.waitingUser) {
            if (this.waitingUser[timeControl] === ws) {
                this.waitingUser[timeControl] = null;
                return;
            }
        }

        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex > -1) {
            const game = this.games[gameIndex];
            const otherPlayer = game.player1 === ws ? 'b' : 'w';
            if (game.connectionStatus[otherPlayer] === 'disconnected') {
                game.abortGame();
                return;
            }
            
            const { _id } = ws.user;
            if (_id.equals(game.player1.user._id)) {
                game["connectionStatus"]['w'] = 'disconnected';
                game.player2.send(JSON.stringify({ type: OPPONENT_DISCONNECT }));
            } else {
                game["connectionStatus"]['b'] = 'disconnected';
                game.player1.send(JSON.stringify({ type: OPPONENT_DISCONNECT }));
            }
        }

        // Remove from invite list if they leave before starting
        Object.keys(this.invites).forEach(code => {
            if (this.invites[code]['ws'] === ws) {
                delete this.invites[code];
            }
        });
    }

    attachMessageHandler(ws) {
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                const gameIndex = this.findGameByPlayer(ws);
                if (gameIndex > -1) {
                    const game = this.games[gameIndex];
                    game.makeMove(ws, message);
                }
            }
            catch (e) {
                console.log("ERROR:", e);
            }
        })
    }

    reconnectPlayer(ws, existingGame) {
        const playerId = ws.user._id;
        const color = existingGame.player1.user._id.equals(playerId) ? "w" : "b";
        const existingPlayer = existingGame[color === "w" ? "player1" : "player2"];
        if (existingPlayer.readyState === existingPlayer.OPEN) {
            existingPlayer.close();
        }

        existingGame[color === "w" ? "player1" : "player2"] = ws;
        existingGame.connectionStatus[color] = "connected";

        const otherPlayer = existingGame.getOtherPlayer(ws);

        const gameState = {
            type: "game_reconnect",
            payload: {
                color,
                pgn: existingGame.chess.pgn(),
                timeLeft: existingGame.timeLeft,
                opponent: {
                    _id: otherPlayer.user._id,
                    username: otherPlayer.user.username
                }
            }
        };
        ws.readyState === ws.OPEN && ws.send(JSON.stringify(gameState));

        if (otherPlayer.readyState === otherPlayer.OPEN) {
            otherPlayer.send(JSON.stringify({
                type: "opponent_reconnected",
                payload: { connectionStatus: existingGame.connectionStatus }
            }));
        }
        this.attachMessageHandler(ws);
    }

}

module.exports = GameManager;