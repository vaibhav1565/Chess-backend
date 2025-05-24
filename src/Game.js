const WebSocket = require('ws');
const {Chess} = require("chess.js");

const {
    COLORS,
    CONNECTION_STATUS,
    MESSAGE_TYPES,
    GAME_END_REASONS,
    GAME_SETTINGS,
    // INITIAL_PGN,
} = require('./chessConstants');


const createChessInstance = () => {
    const chessInstance = new Chess();
    // chessInstance.loadPgn(INITIAL_PGN, {strict: true});
    return chessInstance;
};

class Game {

    static GAME_STATE = {
        ACTIVE: 'active',
        ENDED: 'ended'
    }

    constructor(player1, player2, gameManager, minutes, increment) {
        this.player1 = player1;
        this.player2 = player2;
        this.gameManager = gameManager;

        this.minutes = minutes;
        this.increment = increment;

        this.chess = createChessInstance();

        this.connectionStatus = {
            [player1.user._id]: CONNECTION_STATUS.CONNECTED,
            [player2.user._id]: CONNECTION_STATUS.CONNECTED
        }

        this.timeLeft = {
            [player1.user._id]: minutes * 60 * 1000,
            [player2.user._id]: minutes * 60 * 1000
        }

        new Array(player1, player2).forEach((player, index) => {
            const opponent = index === 0 ? player2 : player1;
            this.broadcastToSocket(player, {
                type: MESSAGE_TYPES.GAME_BEGIN,
                payload: {
                    color: index === 0 ? COLORS.WHITE : COLORS.BLACK,
                    minutes,
                    increment,
                    opponent: {
                        _id: opponent.user._id,
                        username: opponent.user.username
                    }
                }
            });
        })

        console.log(`[Game Created] ${player1.user.username} (w) vs ${player2.user.username} (b) - ${minutes} min`);

        this.gameState = Game.GAME_STATE.ACTIVE;

        this.drawOffer = null;
        // this.drawOffersCount = {
        //     [player1.user._id]: 0,
        //     [player2.user._id]: 0
        // };

        this.timer = null;
        this.updateGameClock();
    }

    updateGameClock() {
        if (this.gameState === Game.GAME_STATE.ENDED) {
            clearInterval(this.timer);
            return;
        }

        clearInterval(this.timer);

        let lastTime = Date.now();

        this.timer = setInterval(() => {
            const currentTurn = this.chess.turn();
            const currentId = this.chess.turn() === COLORS.WHITE ? this.player1.user._id : this.player2.user._id;

            // console.log(`[Timer] ${currentTurn === COLORS.WHITE ? this.player1.user.username : this.player2.user.username} has ${Math.floor(this.timeLeft[currentId] / 1000)}s left`);

            const currentTime = Date.now();
            const elapsed = currentTime - lastTime;
            lastTime = currentTime;

            // this.timeLeft[currentId] -= (elapsed - this.increment);
            this.timeLeft[currentId] -= (elapsed);

            if (this.timeLeft[currentId] <= 0) {
                clearInterval(this.timer);
                if (this.connectionStatus[this.player1.user._id] === CONNECTION_STATUS.DISCONNECTED &&
                    this.connectionStatus[this.player2.user._id] === CONNECTION_STATUS.DISCONNECTED) {
                    this.endGame(GAME_END_REASONS.ABORT, null);
                } else {
                    this.endGame(GAME_END_REASONS.TIMEOUT, currentTurn);
                }
            }
        }, GAME_SETTINGS.INTERVAL)
    }

    endGame(reason, loser) {
        if (this.gameState === Game.GAME_STATE.ENDED) {
            console.log("endGame- Game already ended", reason, loser);
            return;
        }
        this.gameState = Game.GAME_STATE.ENDED;
        clearInterval(this.timer);
        this.cleanup();

        console.log(`[Game Over] Reason: ${reason}, Loser: ${loser}`);

        console.log(`[Game Stats] Total Moves: ${Math.floor(this.chess.history().length)}`);
        console.log(`[Game Stats] White Time Left: ${Math.floor(this.timeLeft[this.player1.user._id])}`);
        console.log(`[Game Stats] Black Time Left: ${Math.floor(this.timeLeft[this.player2.user._id])}`);

        const gameOverMessage = { type: MESSAGE_TYPES.GAME_OVER, payload: { reason, loser } };
        this.broadcastToSocket(this.player1, gameOverMessage);
        this.broadcastToSocket(this.player2, gameOverMessage);

        console.log("###############################################")
    }

    getOtherPlayer(ws) {
        if (ws.user._id === this.player1.user._id) return this.player2;
        if (ws.user._id === this.player2.user._id) return this.player1;
        return null;
    }

    determineGameOutcome() {
        let reason;
        let loser = null;
        if (this.chess.isCheckmate()) {
            reason = GAME_END_REASONS.CHECKMATE
            loser = this.chess.turn();
        }
        else if (this.chess.isDrawByFiftyMoves()) {
            reason = GAME_OVER_MESSAGES.FIFTY_MOVES;
        }
        else if (this.chess.isInsufficientMaterial()) {
            reason = GAME_OVER_MESSAGES.INSUFFICIENT_MATERIAL;
        }
        else if (this.chess.isStalemate()) {
            reason = GAME_OVER_MESSAGES.STALEMATE;
        }
        else if (this.chess.isThreefoldRepetition()) {
            reason = GAME_OVER_MESSAGES.THREEFOLD_REPETITION;
        }
        else if (this.chess.isDraw()) {
            reason = GAME_END_REASONS.DRAW;
        }

        this.endGame(reason, loser);
    }

    handleChat(ws, message) {
        if (this.gameState !== Game.GAME_STATE.ACTIVE) {
            this.broadcastToSocket(ws, {
                type: MESSAGE_TYPES.ERROR,
                payload: "Cannot chat - game is not active"
            });
            return;
        }

        const text = message.payload?.text?.trim();
        if (!text) {
            this.broadcastToSocket(ws, {
                type: MESSAGE_TYPES.ERROR,
                payload: "Message cannot be empty"
            });
            return;
        }

        if (text.length > GAME_SETTINGS.MAX_MESSAGE_LENGTH) {
            this.broadcastToSocket(ws, {
                type: MESSAGE_TYPES.ERROR,
                payload: `Message too long (max ${GAME_SETTINGS.MAX_MESSAGE_LENGTH} characters)`
            });
            return;
        }

        const chatMessage = {
            type: MESSAGE_TYPES.CHAT_MESSAGE,
            payload: {
                from: ws.user.username,
                text: text,
            }
        };

        console.log(`[Chat] ${ws.user.username}: ${text}`);

        const otherPlayer = this.getOtherPlayer(ws);
        this.broadcastToSocket(otherPlayer, chatMessage);
    }

    handleResignation(ws) {
        clearInterval(this.timer);
        this.endGame(GAME_END_REASONS.RESIGN, ws === this.player1 ? COLORS.WHITE : COLORS.BLACK);
    }

    handleDrawOffer(ws) {
        // if (this.drawOffersCount[ws.user._id] >= GAME_SETTINGS.MAX_DRAW_OFFERS) {
        //     this.broadcastToSocket(ws, {
        //         type: MESSAGE_TYPES.ERROR,
        //         payload: `You have reached the maximum number of draw offers (${GAME_SETTINGS.MAX_DRAW_OFFERS})`
        //     });
        //     return;
        // }

        if (this.drawOffer !== null) {
            this.broadcastToSocket(ws, {
                type: MESSAGE_TYPES.ERROR,
                payload: "Draw already offered"
            });
            return;
        }

        this.drawOffer = ws.user._id;
        // this.drawOffersCount[ws.user._id]++;

        const otherPlayer = this.getOtherPlayer(ws);
        const message = {
            type: MESSAGE_TYPES.DRAW_OFFER
        };
        this.broadcastToSocket(otherPlayer, message);
    }

    handleDrawAccept(ws) {
        if (!this.drawOffer) {
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: "No draw offer pending" });
            return;
        }
        if (this.drawOffer === ws.user._id) {
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: "Cannot accept your own draw offer" });
            return;
        }
        const otherPlayer = this.getOtherPlayer(ws);
        this.broadcastToSocket(otherPlayer, {type: MESSAGE_TYPES.DRAW_ACCEPTED});
        this.endGame(GAME_END_REASONS.DRAW_BY_AGREEMENT, null);
    }

    handleDrawReject(ws) {
        if (!this.drawOffer) {
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: "No draw offer pending" });
            return;
        }
        if (this.drawOffer === ws.user._id) {
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: "Cannot reject your own draw offer" });
            return;
        }

        const offeringPlayer = this.getOtherPlayer(ws);
        this.drawOffer = null;

        this.broadcastToSocket(offeringPlayer, {
            type: MESSAGE_TYPES.DRAW_REJECTED,
        });
    }

    handleChessMove(ws, message) {
        const isValidTurn = (this.chess.turn() === COLORS.WHITE && ws.user._id === this.player1.user._id) || (this.chess.turn() === COLORS.BLACK && ws.user._id === this.player2.user._id);
        if (!isValidTurn) return;

        try {
            if (!message.payload || typeof message.payload !== 'object') {
                console.log(message.payload);
                throw new Error("Invalid move format");
            }

            const move = this.chess.move(message.payload, { strict: true });
            if (!move) {
                throw new Error("Invalid move");
            }
            console.log(`[MOVE]- ${ws.user.username}:`, message.payload);

            clearInterval(this.timer);

            const other = this.getOtherPlayer(ws);
            this.broadcastToSocket(other, message);
            if (this.chess.isGameOver()) {
                this.determineGameOutcome();
            }
            else {
                this.updateGameClock();
            }
        }
        catch (e) {
            console.log("ERROR:", e);
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: e.message });
        }
    }

    handleGameAction(ws, message) {
        if (this.gameState !== Game.GAME_STATE.ACTIVE) {
            this.broadcastToSocket(ws, { type: MESSAGE_TYPES.ERROR, payload: "Game is not active" });
            return;
        }

        const handlers = {
            [MESSAGE_TYPES.RESIGN]: () => this.handleResignation(ws),
            [MESSAGE_TYPES.CHAT_MESSAGE]: () => this.handleChat(ws, message),
            [MESSAGE_TYPES.DRAW_OFFER]: () => this.handleDrawOffer(ws),
            [MESSAGE_TYPES.DRAW_ACCEPT]: () => this.handleDrawAccept(ws),
            [MESSAGE_TYPES.DRAW_REJECT]: () => this.handleDrawReject(ws),
            [MESSAGE_TYPES.MOVE]: () => this.handleChessMove(ws, message)
        };

        const handler = handlers[message.type];
        if (handler) {
            handler();
        }
        else {
            console.log("[Message]- Unrecognised message type", message);
        }
    }

    handleDisconnection(ws) {

        const color = ws.user._id === this.player1.user._id ? COLORS.WHITE : COLORS.BLACK;
        this.connectionStatus[ws.user._id] = CONNECTION_STATUS.DISCONNECTED;

        const message = { type: MESSAGE_TYPES.OPPONENT_DISCONNECT };

        const otherPlayer = this.getOtherPlayer(ws);
        this.broadcastToSocket(otherPlayer, message);

        console.log(`[Disconnect] ${ws.user.username} (${color}) disconnected`);

        // Check if both players are disconnected
        if (this.connectionStatus[this.player1.user._id] === CONNECTION_STATUS.DISCONNECTED &&
            this.connectionStatus[this.player2.user._id] === CONNECTION_STATUS.DISCONNECTED) {
            console.log('[Game] Both players disconnected - ending game');
            this.endGame(GAME_END_REASONS.ABORT, null);
        }
    }

    cleanup() {
        this.gameManager.removeGame(this);
    }

    broadcastToSocket(ws, message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}

module.exports = Game;