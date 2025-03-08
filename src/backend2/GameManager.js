const Game = require("./Game.js");
const { DISCONNECT } = require("./messages.js");
const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor() {
        this.waitingUser = null;
        this.games = [];
        this.invites = {}; // Store invite codes: { code: player }
    }

    isPlayerInGame(player) {
        for (const game of this.games) {
            if (game.player1 === player || game.player2 === player) {
                return true;
            }
        }
        return false;
    }

    removeGame(game) {
        const index = this.games.indexOf(game);
        if (index > -1) this.games.splice(index, 1);
    }

    findGameByPlayer(ws) {
        return this.games.find(game => game.player1 === ws || game.player2 === ws);
    }

    addPlayer(ws, inviteCode = null) {
        if (this.isPlayerInGame(ws)) return;
        if (inviteCode) {
            if (this.invites[inviteCode]) {
                const otherPlayer = this.invites[inviteCode];
                delete this.invites[inviteCode];
                if (otherPlayer === ws) return;

                const newGame = new Game(otherPlayer, ws, this, inviteCode);
                this.games.push(newGame);
                this.attachMessageHandler(otherPlayer);
                this.attachMessageHandler(ws);
            }
            else {
                ws.send(JSON.stringify({ type: "error", message: "Invalid invite code" }));
            }
        }
        else {
            if (!this.waitingUser || this.waitingUser.readyState !== this.waitingUser.OPEN) {
                this.waitingUser = null;
            }
            if (!this.waitingUser) {
                this.waitingUser = ws;
            } else {
                if (this.waitingUser === ws) return;
                const newGame = new Game(this.waitingUser, ws, this, uuidv4().slice(0, 6));
                this.games.push(newGame);
                this.attachMessageHandler(this.waitingUser);
                this.attachMessageHandler(ws);

                this.waitingUser = null;
            }
        }
    }

    createInvite(ws) {
        const inviteAlreadyExists = Object.keys(this.invites).some(k => this.invites[k] === ws);
        if (inviteAlreadyExists) return;

        const inviteCode = uuidv4().slice(0, 6);
        this.invites[inviteCode] = ws;
        setTimeout(() => { delete this.invites[inviteCode]; }, 5 * 60 * 1000); // Expires after 5 minutes
        return inviteCode; // Send this code to the player
    }

    removePlayer(ws) {
        if (this.waitingUser === ws) {
            this.waitingUser = null;
        }
        else {
            const game = this.findGameByPlayer(ws);
            if (game) {
                const other = game.getOtherPlayer(ws);
                if (other && other.readyState === other.OPEN) {
                    other.send(JSON.stringify({ type: DISCONNECT }));
                    other.close();
                }
                this.removeGame(game);
            }
        }

        // Remove from invite list if they leave before starting
        Object.keys(this.invites).forEach(code => {
            if (this.invites[code] === ws) {
                delete this.invites[code];
            }
        });
    }

    attachMessageHandler(ws) {
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                const game = this.findGameByPlayer(ws);
                if (game) {
                    game.makeMove(ws, message);
                }
            }
            catch(e) {
                console.log("ERROR", e);
            }
        })
    }
}

module.exports = GameManager;