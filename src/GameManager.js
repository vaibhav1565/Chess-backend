const Game = require("./Game.js");
const { v4: uuidv4 } = require('uuid');
const { DISCONNECT } = require("./messages.js");

class GameManager {
    constructor() {
        this.waitingUser = {
            1: null,
            3: null,
            10: null,
            30: null
        };
        this.games = [];
        this.invites = {}; // Store invite codes: { code: {ws: player, timeControl: minutes} }
    }

    removeGame(gameIndex) {
        this.games.splice(gameIndex, 1);
    }

    findGameByPlayer(ws) {
        const { _id } = ws.user;
        return this.games.findIndex(game => game.player1.user._id.equals(_id) || game.player2.user._id.equals(_id));
    }

    addPlayer(ws, inviteCode, minutes) {
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

        if (inviteCode) {
            if (this.invites[inviteCode]) {
                if (minutes !== this.invites[inviteCode]['timeControl']) return;
                const otherPlayer = this.invites[inviteCode]['ws'];
                if (otherPlayer.user._id.equals(ws.user._id)) return;
                delete this.invites[inviteCode];

                const newGame = new Game(otherPlayer, ws, this, minutes);
                this.games.push(newGame);
                this.attachMessageHandler(otherPlayer);
                this.attachMessageHandler(ws);
            }
            else {
                ws.send(JSON.stringify({ type: "error", message: "Invalid invite code" }));
            }
        }
        else {
            if (!this.waitingUser[minutes] || this.waitingUser[minutes].readyState !== this.waitingUser[minutes].OPEN) {
                this.waitingUser[minutes] = null;
            }
            if (!this.waitingUser[minutes]) {
                this.waitingUser[minutes] = ws;
                ws.send(JSON.stringify({ type: "message", message: "Waiting for another player to join..." }))
            } else {
                if (this.waitingUser[minutes].user._id.equals(ws.user._id)) return;
                const newGame = new Game(this.waitingUser[minutes], ws, this, minutes);
                this.games.push(newGame);
                this.attachMessageHandler(this.waitingUser[minutes]);
                this.attachMessageHandler(ws);

                this.waitingUser[minutes] = null;
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

        const { _id } = ws.user;
        const inviteAlreadyExists = Object.keys(this.invites).some(code => this.invites[code]['ws'].user._id.equals(_id));
        if (inviteAlreadyExists) return;

        const inviteCode = uuidv4().slice(0, 6);
        this.invites[inviteCode] = { ws, timeControl: minutes };
        setTimeout(() => { delete this.invites[inviteCode]; }, 5 * 60 * 1000); // Expires after 5 minutes

        ws.send(JSON.stringify({ type: "invite_code", code: inviteCode }));
    }

    deleteInvite(ws) {
        const { _id } = ws.user;
        for (let invite in this.invites) {
            if (this.invites[invite]['ws'].user._id.equals(_id)) {
                delete this.invites[invite];
                if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "message", message: "Invite deleted" }));
                break;
            }
        }
    }

    removePlayer(ws) {
        for (let user in this.waitingUser) {
            if (this.waitingUser[user] === ws) {
                this.waitingUser[user] = null;
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
                game.changeConnectionStatus('w', 'disconnected');
                game.player2.send(JSON.stringify({ type: DISCONNECT }));
            } else {
                game.changeConnectionStatus('b', 'disconnected');
                game.player1.send(JSON.stringify({ type: DISCONNECT }));
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
        if (existingPlayer && existingPlayer.readyState === existingPlayer.OPEN) {
            existingPlayer.close();
        }

        existingGame[color === "w" ? "player1" : "player2"] = ws;
        existingGame.connectionStatus[color] = "connected";

        const gameState = {
            type: "game_reconnect",
            payload: {
                color,
                pgn: existingGame.chess.pgn(),
                timeLeft: existingGame.timeLeft,
            }
        };
        ws.send(JSON.stringify(gameState));

        const otherPlayer = existingGame.getOtherPlayer(ws);
        if (otherPlayer && otherPlayer.readyState === otherPlayer.OPEN) {
            otherPlayer.send(JSON.stringify({
                type: "opponent_reconnected",
                payload: { connectionStatus: existingGame.connectionStatus }
            }));
        }
        this.attachMessageHandler(ws);
    }

}

module.exports = GameManager;