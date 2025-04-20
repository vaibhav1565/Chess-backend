const { Chess } = require("chess.js");
const WebSocket = require('ws');

// const { MOVE, GAME_BEGIN } = require('./messages.js');
// const { GAME_OVER_MESSAGES } = require('./messages.js');

// const pgn = `[Event "It (cat.17)"]
// [Site "Wijk aan Zee (Netherlands)"]
// [Date "1999.??.??"]
// [Round "?"]
// [White "Garry Kasparov"]
// [Black "Veselin Topalov"]
// [Result "1-0"]
// [TimeControl ""]
// [Link "https://www.chess.com/games/view/969971"]

// 1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6
// Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4
// 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1
// d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+
// Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+
// Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8
// Rd3 40. Qa8 c3`;


class Game {
    constructor(player1, player2, gameManager, minutes) {
        this.player1 = player1;
        this.player2 = player2;
        this.gameManager = gameManager;

        this.chess = new Chess();
        // this.chess.loadPgn(pgn);

        this.connectionStatus = {
            'w': 'connected',
            'b': 'connected'
        }

        this.timeLeft = {
            [player1.user._id]: minutes * 60 * 1000,
            [player2.user._id]: minutes * 60 * 1000
        }


        new Array(player1, player2).forEach((player, index) => {
            const opponent = index === 0 ? player2 : player1;
            if (player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({
                    type: "game_begin",
                    payload: {
                        color: index === 0 ? 'w' : 'b',
                        minutes,
                        opponent: {
                            _id: opponent.user._id,
                            username: opponent.user.username
                        }
                    }
                }));
            }
        })

        console.log(`[Game Created] ${player1.user.username} (w) vs ${player2.user.username} (b) - ${minutes} min`);

        this.gameState = "active";

        this.drawOffer = null;
        this.drawOffersCount = {
            [player1.user._id]: 0,
            [player2.user._id]: 0
        };

        this.MAX_MESSAGE_LENGTH = 200; // Maximum characters per message

        this.timer = null;
        this.handleTimer();
    }

    handleTimer() {
        if (this.gameState !== "active") {
            clearInterval(this.timer);
            return;
        }

        clearInterval(this.timer);

        let lastTime = Date.now();

        this.timer = setInterval(() => {
            const currentTurn = this.chess.turn();
            const currentId = this.chess.turn() === 'w' ? this.player1.user._id : this.player2.user._id;

            // console.log(`[Timer] ${currentTurn === 'w' ? this.player1.user.username : this.player2.user.username} has ${Math.floor(this.timeLeft[currentId] / 1000)}s left`);

            const currentTime = Date.now();
            const elapsed = currentTime - lastTime;
            lastTime = currentTime;

            this.timeLeft[currentId] -= elapsed;


            if (this.timeLeft[currentId] <= 0) {
                clearInterval(this.timer);
                if (this.connectionStatus['w'] === 'disconnected' && this.connectionStatus['b'] === 'disconnected') {
                    this.endGame("abort", null);
                } else {
                    this.endGame("timeout", currentTurn);
                }
            }
        }, 1000)
    }

    endGame(reason, loser) {
        if (this.gameState !== "active") {
            return;
        }
        this.gameState = "ended";

        console.log(`[Game Over] Reason: ${reason}, Loser: ${loser}`);

        const gameOverMessage = JSON.stringify({ type: "game_over", payload: { reason, loser } });
        if (this.player1.readyState === WebSocket.OPEN) {
            this.player1.send(gameOverMessage);
            // this.player1.close();
        }
        if (this.player2.readyState === WebSocket.OPEN) {
            this.player2.send(gameOverMessage);
            // this.player2.close();
        }
        this.gameManager.removeGame(this);
    }

    getOtherPlayer(ws) {
        if (ws.user._id === this.player1.user._id) return this.player2;
        if (ws.user._id === this.player2.user._id) return this.player1;
        return null;
    }

    handleGameOver() {
        let reason;
        let loser = null;
        if (this.chess.isCheckmate()) {
            reason = "checkmate"
            loser = this.chess.turn();
        }
        // else if (this.chess.isDrawByFiftyMoves()) {
        //     reason = GAME_OVER_MESSAGES.FIFTY_MOVES;
        // }
        // else if (this.chess.isInsufficientMaterial()) {
        //     reason = GAME_OVER_MESSAGES.INSUFFICIENT_MATERIAL;
        // }
        // else if (this.chess.isStalemate()) {
        //     reason = GAME_OVER_MESSAGES.STALEMATE;
        // }
        // else if (this.chess.isThreefoldRepetition()) {
        //     reason = GAME_OVER_MESSAGES.THREEFOLD_REPETITION;
        // }
        else {
            reason = "draw";
        }

        console.log(`[Game Stats] Total Moves: ${Math.floor(this.chess.history().length / 2)}`);
        console.log(`[Game Stats] White Time Left: ${Math.floor(this.timeLeft[this.player1.user._id] / 1000)}s`);
        console.log(`[Game Stats] Black Time Left: ${Math.floor(this.timeLeft[this.player2.user._id] / 1000)}s`);

        this.endGame(reason, loser);
        this.cleanup();
    }

    handleChat(ws, message) {
        if (this.gameState !== "active") {
            ws.send(JSON.stringify({
                type: "error",
                payload: "Cannot chat - game is not active"
            }));
            return;
        }

        const text = message.payload?.text?.trim();
        if (!text) {
            ws.send(JSON.stringify({
                type: "error",
                payload: "Message cannot be empty"
            }));
            return;
        }

        if (text.length > this.MAX_MESSAGE_LENGTH) {
            ws.send(JSON.stringify({
                type: "error",
                payload: `Message too long (max ${this.MAX_MESSAGE_LENGTH} characters)`
            }));
            return;
        }

        const chatMessage = {
            type: "chat_message",
            payload: {
                from: ws.user.username,
                text: text,
                // timestamp: Date.now()
            }
        };

        console.log(`[Chat] ${ws.user.username}: ${text}`);

        const otherPlayer = this.getOtherPlayer(ws);
        if (otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify(chatMessage));
        }
    }

    makeMove(ws, message) {
        // console.log(message);
        if (this.gameState !== "active") {
            ws.send(JSON.stringify({ type: "error", payload: "Game is not active" }));
            return;
        }
        if (message.type === "resign") {
            clearInterval(this.timer);
            this.endGame("resign", ws === this.player1 ? 'w' : 'b');
            return;
        }

        if (message.type === "chat_message") {
            this.handleChat(ws, message);
            return;
        }

        if (message.type === "draw_offer") {
            if (this.drawOffersCount[ws.user._id] >= 3) {
                ws.send(JSON.stringify({
                    type: "error",
                    payload: "You have reached the maximum number of draw offers (3)"
                }));
                return;
            }

            if (this.drawOffer === ws.user._id) {
                ws.send(JSON.stringify({
                    type: "error",
                    payload: "Draw already offered"
                }));
                return;
            }

            this.drawOffer = ws.user._id;
            this.drawOffersCount[ws.user._id]++;

            const otherPlayer = this.getOtherPlayer(ws);
            if (otherPlayer.readyState === WebSocket.OPEN) {
                otherPlayer.send(JSON.stringify({
                    type: "draw_offer"
                }));
            }
            return;
        }

        if (message.type === "draw_accept") {
            if (!this.drawOffer) {
                ws.send(JSON.stringify({ type: "error", payload: "No draw offer pending" }));
                return;
            }
            if (this.drawOffer === ws.user._id) {
                ws.send(JSON.stringify({ type: "error", payload: "Cannot accept your own draw offer" }));
                return;
            }
            clearInterval(this.timer);
            this.endGame("draw", null);
            return;
        }

        if (message.type === "draw_reject") {
            if (!this.drawOffer) {
                ws.send(JSON.stringify({ type: "error", payload: "No draw offer pending" }));
                return;
            }
            if (this.drawOffer === ws.user._id) {
                ws.send(JSON.stringify({ type: "error", payload: "Cannot reject your own draw offer" }));
                return;
            }

            const offeringPlayer = this.getOtherPlayer(ws);
            this.drawOffer = null;

            if (offeringPlayer.readyState === WebSocket.OPEN) {
                offeringPlayer.send(JSON.stringify({
                    type: "draw_rejected",
                }));
            }
            return;
        }

        if (message.type !== "move") return;

        const isValidTurn = (this.chess.turn() === 'w' && ws.user._id === this.player1.user._id) || (this.chess.turn() === 'b' && ws.user._id === this.player2.user._id);
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

            clearInterval(this.timer);

            const other = this.getOtherPlayer(ws);
            if (other.readyState === WebSocket.OPEN) {
                other.send(JSON.stringify(message));
            }
            if (this.chess.isGameOver()) {
                this.handleGameOver();
            }
            else {
                this.handleTimer();
            }

            console.log(`[Move] ${ws.user.username}: ${move.san}`);
        }
        catch (e) {
            console.log("ERROR:", e);
            ws.send(JSON.stringify({ type: "error", payload: e.message }));
        }
    }

    handleDisconnection(ws) {
        const message = JSON.stringify({ type: "opponent_disconnect" });

        const color = ws.user._id === this.player1.user._id ? 'w' : 'b';
        this.connectionStatus[color] = 'disconnected';

        const otherPlayer = this.getOtherPlayer(ws);
        if (otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(message);
        }

        console.log(`[Disconnect] ${ws.user.username} (${color}) disconnected`);
    }

    cleanup() {
        console.log('[Cleanup] Starting game cleanup');
        // Clear any running timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // Close WebSocket connections
        if (this.player1?.readyState === WebSocket.OPEN) {
            this.player1.close();
        }
        if (this.player2?.readyState === WebSocket.OPEN) {
            this.player2.close();
        }

        // Clear game state
        this.gameState = "ended";
        this.chess = null;
        this.timeLeft = null;
        this.drawOffer = null;
        this.drawOffersCount = null;
        this.connectionStatus = null;
    }
}

module.exports = Game;