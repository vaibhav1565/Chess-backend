const { Chess } = require("chess.js");
const { RESIGN, MOVE, GAME_BEGIN } = require('./messages.js');
const { GAME_OVER_MESSAGES } = require('./messages.js');

class Game {
    constructor(player1, player2, gameManager, minutes) {
        this.player1 = player1;
        this.player2 = player2;
        this.gameManager = gameManager;

        this.chess = new Chess();
        this.connectionStatus = {
            'w': 'connected',
            'b': 'connected'
        }

        this.timeLeft = { w: minutes * 60 * 1000, b: minutes * 60 * 1000 }; // 'minutes' minute each
        this.timer;

        (this.player1.readyState === this.player1.OPEN) &&
            this.player1.send(JSON.stringify({
                type: GAME_BEGIN,
                payload: {
                    color: "w",
                    minutes,
                    opponent: { username: player2.user.username, _id: player2.user._id }
                }
            }));
        (this.player2.readyState === this.player2.OPEN) &&
            this.player2.send(JSON.stringify({
                type: GAME_BEGIN,
                payload: {
                    color: "b",
                    minutes,
                    opponent: { username: player1.user.username, _id: player1.user._id }
                }
            }));

        this.startTurnTimer();
    }

    startTurnTimer() {
        clearInterval(this.timer);

        let lastMoveTime = Date.now();

        this.timer = setInterval(() => {
            const turn = this.chess.turn();
            const elapsed = Date.now() - lastMoveTime;
            this.timeLeft[turn] -= elapsed;
            lastMoveTime = Date.now();

            if (this.timeLeft[turn] <= 0) {
                const opponentColor = turn === 'w' ? 'b' : 'w';
                if (this.connectionStatus[opponentColor] === 'disconnected') {
                    this.endGame(GAME_OVER_MESSAGES.TIMEOUT, null);
                }
                else {
                    this.endGame(GAME_OVER_MESSAGES.TIMEOUT, this.chess.turn());
                }
            }
        }, 100);
    }

    abortGame() {
        this.endGame(GAME_OVER_MESSAGES.TIMEOUT, null)
    }

    endGame(reason, loser) {
        clearInterval(this.timer);
        const gameOverMessage = JSON.stringify({ type: "GAME_OVER", payload: { reason, loser } });
        if (this.player1.readyState === this.player1.OPEN) {
            this.player1.send(gameOverMessage);
            this.player1.close();
        }
        if (this.player2.readyState === this.player2.OPEN) {
            this.player2.send(gameOverMessage);
            this.player2.close();
        }
        this.gameManager.removeGame(this);
    }

    getOtherPlayer(ws) {
        const { _id } = ws.user;

        if (_id.equals(this.player1.user._id)) return this.player2;
        return this.player1;
    }

    handleGameOver() {
        let reason;
        let loser = null;
        if (this.chess.isCheckmate()) {
            reason = GAME_OVER_MESSAGES.CHECKMATE;
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
        this.endGame(reason, loser);
    }

    makeMove(ws, message) {
        // console.log(message);
        if (message.type === RESIGN) {
            this.endGame(GAME_OVER_MESSAGES.RESIGN, ws === this.player1 ? 'w' : 'b');
        }
        else if (message.type === MOVE &&
            (this.chess.turn() === 'w' && ws.user._id.equals(this.player1.user._id)) ||
            (this.chess.turn() === 'b' && ws.user._id.equals(this.player2.user._id))) {
            try {
                this.chess.move(message.payload, { strict: true });
                this.startTurnTimer(); // Switch to next player's timer
                const other = this.getOtherPlayer(ws);
                if (other.readyState === other.OPEN) {
                    other.send(JSON.stringify(message));
                }
                if (this.chess.isGameOver()) {
                    this.handleGameOver();
                }
            }
            catch (e) {
                console.log(e);
            }
        }
    }
}

module.exports = Game;