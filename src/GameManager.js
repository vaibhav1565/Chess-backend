const Game = require("./Game.js");
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const {
    INVITE,
    MESSAGE_TYPES,
    MESSAGE_VALIDATION,
    TIME_CONTROLS
} = require('./chessConstants');

class GameManager {
    constructor() {
        this.waitingUser = {};
        this.queueLocks = {};
        this.games = [];
        this.invites = {};

        TIME_CONTROLS.forEach(({ minutes, increment }) => {
            const key = `${minutes}:${increment}`;
            this.waitingUser[key] = null;
            this.queueLocks[key] = false;
        });
    }

    isValidTimeControl(timeConfig) {
        return TIME_CONTROLS.some(control =>
            control.minutes === timeConfig.minutes && control.increment === timeConfig.increment
        );
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
        console.group();
        console.log("[ADD PLAYER VIA INVITE]");
        console.log("Function payload:", ws, inviteCode);

        if (!this.invites[inviteCode]) {
            console.log(`Invalid invite code attempt: ${inviteCode}`);
            console.groupEnd();
            throw new Error(MESSAGE_VALIDATION.INVALID_INVITE_CODE);
        }

        const otherPlayer = this.invites[inviteCode]['ws'];

        if (otherPlayer.user._id === ws.user._id) {
            console.log("Player tried to join their own invite");
            console.groupEnd();
            return;
        }

        console.log(`Invite code valid. Players matched: ${otherPlayer.user.username} and ${ws.user.username}`);

        const { minutes, increment } = this.invites[inviteCode];
        const newGame = new Game(otherPlayer, ws, this, minutes, increment);
        this.games.push(newGame);
        console.log(`Game created via invite. Total games: ${this.games.length}`);

        this.attachMessageHandler(otherPlayer);
        this.attachMessageHandler(ws);

        delete this.invites[inviteCode];
        console.groupEnd();
    }

    async addPlayerViaQueue(ws, timeConfig) {
        console.group();
        console.log("Function payload:", timeConfig);
        const timeControlKey = `${timeConfig.minutes}:${timeConfig.increment}`;
        console.log(`Player ${ws.user.username} joining queue for ${timeControlKey} game`);

        const MAX_WAIT_TIME = 5000; // 5 seconds
        const startTime = Date.now();

        if (! this.isValidTimeControl(timeConfig)) {
            console.log(`Invalid time control selected: ${timeControlKey}`);
            console.groupEnd();
            throw new Error(MESSAGE_VALIDATION.INVALID_TIME_CONTROL);
        }

        // Wait until lock is available
        while (this.queueLocks[timeControlKey]) {
            if (Date.now() - startTime > MAX_WAIT_TIME) {
                console.log(`Timeout while waiting for queue lock on ${timeControlKey}`);
                console.groupEnd();
                throw new Error("Queue lock timeout");
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            this.queueLocks[timeControlKey] = true;

            const waitingPlayer = this.waitingUser[timeControlKey];
            if (!waitingPlayer || waitingPlayer.readyState !== WebSocket.OPEN) {
                console.log(`No waiting player. Player ${ws.user.username} added to queue`);
                this.waitingUser[timeControlKey] = ws;
                this.sendMessage(ws, { type: MESSAGE_TYPES.WAIT });
                console.groupEnd();
                return;
            }

            if (waitingPlayer.user._id === ws.user._id) {
                console.log(`Player ${ws.user.username} is already in the queue`);
                console.groupEnd();
                return;
            }

            console.log(`Matching ${waitingPlayer.user.username} with ${ws.user.username}`);
            this.waitingUser[timeControlKey] = null;
            this.queueLocks[timeControlKey] = false;

            const newGame = new Game(waitingPlayer, ws, this, timeConfig.minutes, timeConfig.increment);
            this.games.push(newGame);
            console.log(`Game created via queue. Total games: ${this.games.length}`);

            this.attachMessageHandler(waitingPlayer);
            this.attachMessageHandler(ws);
        } catch (e) {
            console.log(e);
        } finally {
            this.queueLocks[timeControlKey] = false;
            console.groupEnd();
        }
    }

    createInviteCode(ws, timeConfig) {
        console.log(`Player ${ws.user.username} creating invite for ${timeConfig.minutes} | ${timeConfig.increment} game`);

        if (! this.isValidTimeControl(timeConfig)) {
            console.log(`Invalid time control for invite: ${timeConfig.minutes} | ${timeConfig.increment}`);
            return;
        }

        const inviteCode = uuidv4().slice(0, INVITE.CODE_LENGTH);
        // const timeControlKey = `${timeConfig.minutes}:${timeConfig.increment}`;
        this.invites[inviteCode] = { ws, minutes: timeConfig.minutes, increment: timeConfig.increment };
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
        if (!ws._messageHandler) {
            ws._messageHandler = (data) => {
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
                    console.log("Message parse error:", e);
                    throw new Error(MESSAGE_VALIDATION.INVALID_MESSAGE_FORMAT)
                }
            };
            ws.on('message', ws._messageHandler);
        }
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
