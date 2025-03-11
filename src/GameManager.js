const Game = require("./Game.js");
const { v4: uuidv4 } = require('uuid');
const { DISCONNECT } = require("./messages.js");

class GameManager {
    constructor() {
        this.waitingUser = null;
        this.games = [];
        this.invites = {}; // Store invite codes: { code: player }
    }

    removeGame(gameIndex) {
        this.games.splice(gameIndex, 1);
    }

    findGameByPlayer(ws) {
        const { _id } = ws.user;
        return this.games.findIndex(game => game.player1.user._id.equals(_id) || game.player2.user._id.equals(_id));
    }

    addPlayer(ws, inviteCode = null) {
        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex > -1) return;

        if (inviteCode) {
            if (this.invites[inviteCode]) {
                const otherPlayer = this.invites[inviteCode];
                if (otherPlayer.user._id.equals(ws.user._id)) return;
                delete this.invites[inviteCode];

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
                ws.send(JSON.stringify({type: "message", message: "Waiting for another player to join..."}))
            } else {
                if (this.waitingUser.user._id.equals(ws.user._id)) return;
                // if (this.waitingUser?.user._id.equals(ws.user._id)) return;
                const newGame = new Game(this.waitingUser, ws, this, uuidv4().slice(0, 6));
                this.games.push(newGame);
                this.attachMessageHandler(this.waitingUser);
                this.attachMessageHandler(ws);

                this.waitingUser = null;
            }
        }
    }

    createInvite(ws) {
        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex > -1) return;

        const {_id} = ws.user;
        const inviteAlreadyExists = Object.keys(this.invites).some(code => this.invites[code].user._id.equals(_id));
        if (inviteAlreadyExists) return;

        const inviteCode = uuidv4().slice(0, 6);
        this.invites[inviteCode] = ws;
        setTimeout(() => { delete this.invites[inviteCode]; }, 5 * 60 * 1000); // Expires after 5 minutes
        return inviteCode; // Send this code to the player
    }

    deleteInvite(ws) {
        const { _id } = ws.user;
        for (let invite in this.invites) {
            if (this.invites[invite].user._id.equals(_id)) {
                delete this.invites[invite];
                if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "message", message: "Invite deleted" }));
                break;
            }
        }
    }

    removePlayer(ws) {
        if (this.waitingUser === ws) {
            this.waitingUser = null;
        }
        else {
            const gameIndex = this.findGameByPlayer(ws);
            if (gameIndex > -1) {
                const game = this.games[gameIndex];
                const {_id} = ws.user;
                if (_id.equals(game.player1.user._id)) {
                    game.player1 = null;
                    const otherPlayer = game.player2;
                    if (otherPlayer?.readyState === otherPlayer.OPEN) otherPlayer.send(JSON.stringify({type: DISCONNECT}));
                } else if (_id.equals(game.player2.user._id)) {
                    game.player2 = null;
                    const otherPlayer = game.player1;
                    if (otherPlayer?.readyState === otherPlayer.OPEN) otherPlayer.send(JSON.stringify({ type: DISCONNECT }));
                }

                // If both players have disconnected, remove the game
                if (!game.player1 && !game.player2) {
                    this.removeGame(gameIndex);
                    return;
                }
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

}

module.exports = GameManager;