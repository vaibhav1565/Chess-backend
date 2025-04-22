const Game = require("./Game.js");
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const GAME_CONSTANTS = require('./constants');
const {
    // CONNECTION_STATUS,
    GAME_SETTINGS,
    INVITE,
    MESSAGE_TYPES,
    MESSAGE_VALIDATION
} = GAME_CONSTANTS;

class GameManager {

    constructor() {
        this.waitingUser = Object.fromEntries(
            GAME_SETTINGS.VALID_CONTROLS.map(time => [time, null])
        );
        this.queueLocks = Object.fromEntries(
            GAME_SETTINGS.VALID_CONTROLS.map(time => [time, false])
        );
        this.games = [];
        this.invites = {};

        /* Store invite codes: 
            { 
            code: {ws: player, minutes} 
            }
        */

    }

    // for Game.js
    removeGame(game) {
        const index = this.games.findIndex(g => g === game);
        if (index > -1) {
            this.games.splice(index, 1);
        }
    }

    findGameByPlayer(ws) {
        const { _id } = ws.user;
        return this.games.findIndex(game => game.player1.user._id === _id || game.player2.user._id === _id);
    }

    addPlayerViaInvite(ws, inviteCode) {
        console.log(`Attempting to join with invite code: ${inviteCode}`);

        if (this.invites[inviteCode]) {
            const otherPlayer = this.invites[inviteCode]['ws'];

            if (otherPlayer.user._id === ws.user._id) {
                console.log("Player tried to join their own invite");
                return;
            }

            console.log(`Invite code valid. Players matched: ${otherPlayer.user.username} and ${ws.user.username}`);

            const newGame = new Game(otherPlayer, ws, this, 0.2); // intentionally set for testing purpose
            this.games.push(newGame);
            console.log(`Game created via invite. Total games: ${this.games.length}`);

            this.attachMessageHandler(otherPlayer);
            this.attachMessageHandler(ws);

            delete this.invites[inviteCode];
        } else {
            console.log(`Invalid invite code attempt: ${inviteCode}`);
            this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: MESSAGE_VALIDATION.INVALID_INVITE_CODE });
        }
    }

    async addPlayerViaQueue(ws, minutes) {
        console.log(`Player ${ws.user.username} joining queue for ${minutes}-minute game`);

        if (!GAME_SETTINGS.VALID_CONTROLS.includes(minutes)) {
            console.log(`Invalid time control selected: ${minutes}`);
            this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: MESSAGE_VALIDATION.INVALID_TIME_CONTROL });
            return;
        }

        // Wait until lock is available
        while (this.queueLocks[minutes]) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            this.queueLocks[minutes] = true;

            const waitingPlayer = this.waitingUser[minutes];
            if (!waitingPlayer || waitingPlayer.readyState !== WebSocket.OPEN) {
                console.log(`No waiting player. Player ${ws.user.username} added to queue`);
                this.waitingUser[minutes] = ws;
                this.sendMessage(ws, { type: MESSAGE_TYPES.WAIT });
                return;
            }

            if (this.waitingUser[minutes].user._id === ws.user._id) {
                console.log(`Player ${ws.user.username} is already in the queue`);
                return;
            }

            console.log(`Matching ${waitingPlayer.user.username} with ${ws.user.username}`);
            this.waitingUser[minutes] = null;

            const newGame = new Game(waitingPlayer, ws, this, 0.2); //intentionally set for testing purpose
            this.games.push(newGame);
            console.log(`Game created via queue. Total games: ${this.games.length}`);

            this.attachMessageHandler(waitingPlayer);
            this.attachMessageHandler(ws);
        } finally {
            this.queueLocks[minutes] = false;
        }
    }

    createInvite(ws, minutes) {
        console.log(`Player ${ws.user.username} creating invite for ${minutes}-minute game`);

        if (!GAME_SETTINGS.VALID_CONTROLS.includes(minutes)) {
            console.log(`Invalid time control for invite: ${minutes}`);
            return;
        }

        const inviteCode = uuidv4().slice(0, INVITE.CODE_LENGTH);
        this.invites[inviteCode] = { ws, minutes };
        console.log(`Invite code ${inviteCode} created by ${ws.user.username}`);

        setTimeout(() => {
            if (this.invites[inviteCode]) {
                console.log(`Invite code ${inviteCode} expired`);
                delete this.invites[inviteCode];
            }
        }, INVITE.EXPIRY_TIME);

        this.sendMessage(ws, { type: MESSAGE_TYPES.INVITE_CODE, payload: { code: inviteCode } });
    }

    removePlayer(ws) {
        console.log(`Removing player: ${ws.user.username}`);

        for (let timeControl in this.waitingUser) {
            if (this.waitingUser[timeControl] === ws) {
                console.log(`[REMOVE] Player ${ws.user.username} was in queue for ${timeControl}-minute`);
                this.waitingUser[timeControl] = null;
                return;
            }
        }

        const gameIndex = this.findGameByPlayer(ws);
        if (gameIndex === -1) {
            console.log(`Player ${ws.user.username} not found in any active game`);
            return;
        }

        const game = this.games[gameIndex];
        console.log(`Player ${ws.user.username} disconnected from game`);
        game.handleDisconnection(ws);

        Object.keys(this.invites).forEach(code => {
            if (this.invites[code]['ws'] === ws) {
                console.log(`Removing expired invite code ${code} from disconnected user`);
                delete this.invites[code];
            }
        });
    }

    attachMessageHandler(ws) {
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`Received message from ${ws.user.username}: ${JSON.stringify(message)}`);

                const gameIndex = this.findGameByPlayer(ws);
                if (gameIndex > -1) {
                    const game = this.games[gameIndex];
                    game.handleGameAction(ws, message);
                } else {
                    console.log(`No active game found for ${ws.user.username}`);
                }
            } catch (e) {
                console.error("Message parse error:", e);
                this.sendMessage(ws, { type: MESSAGE_TYPES.ERROR, payload: MESSAGE_VALIDATION.INVALID_MESSAGE_FORMAT });
            }
        });
    }

    sendMessage(ws, message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    // reconnectPlayer(ws, existingGame) {
    //     const playerId = ws.user._id;
    //     const color = existingGame.player1.user._id === playerId ? "w" : "b";
    //     const existingPlayer = existingGame[color === "w" ? "player1" : "player2"];
    //     if (existingPlayer.readyState === WebSocket.OPEN) {
    //         existingPlayer.close();
    //     }

    //     existingGame[color === "w" ? "player1" : "player2"] = ws;
    //     existingGame.connectionStatus[color] = CONNECTION_STATUS.CONNECTED;

    //     const otherPlayer = existingGame.getOtherPlayer(ws);

    //     const gameState = {
    //         type: "game_reconnect",
    //         payload: {
    //             color,
    //             pgn: existingGame.chess.pgn(),
    //             timeLeft: existingGame.timeLeft,
    //             opponent: {
    //                 _id: otherPlayer.user._id,
    //                 username: otherPlayer.user.username
    //             }
    //         }
    //     };
    //     ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(gameState));

    //     if (otherPlayer.readyState === WebSocket.OPEN) {
    //         otherPlayer.send(JSON.stringify({
    //             type: "opponent_reconnected",
    //             payload: { connectionStatus: existingGame.connectionStatus }
    //         }));
    //     }
    //     this.attachMessageHandler(ws);
    // }
}

module.exports = GameManager;
