const {Chess} = require("chess.js");
const { RESIGN, MOVE } = require('./messages.js');
const { GAME_END_MESSAGES } = require('./messages.js');

const minutes = 5;
class Game {
    constructor(player1, player2, gameManager, inviteCode) {
        this.player1 = player1;
        this.player2 = player2;
        this.gameManager = gameManager;
        this.inviteCode = inviteCode;

        this.w = player1.user._id;
        this.b = player2.user._id;
        this.chess = new Chess();

        this.timeLeft = { w: minutes * 60 * 1000, b: minutes * 60 * 1000 }; // 'minutes' minute each
        this.timer;
        this.lastMoveTime;

        this.player1.send(JSON.stringify({ type: "game_begin", payload: { color: "w"} }));
        this.player2.send(JSON.stringify({ type: "game_begin", payload: { color: "b"} }));

        this.startTurnTimer();
    }

    startTurnTimer() {
        clearInterval(this.timer);
        this.lastMoveTime = Date.now();
        this.timer = setInterval(() => {
            const turn = this.chess.turn();
            const elapsed = Date.now() - this.lastMoveTime;
            this.timeLeft[turn] -= elapsed;
            this.lastMoveTime = Date.now();

            if (this.timeLeft[turn] <= 0) {
                this.endGame(GAME_END_MESSAGES.TIMEOUT, this.chess.turn());
                // console.log(`${turn} ran out of time! Game over.`);
            }
        }, 100);
    }

    endGame(reason, loser) {
        clearInterval(this.timer);
        const gameOverMessage = JSON.stringify({ type: "GAME_OVER", payload: { reason, loser } });
        if (this.player1 && this.player1.readyState === this.player1.OPEN) {
            this.player1.send(gameOverMessage);
            this.player1.close();
        }
        if (this.player2 && this.player2.readyState === this.player2.OPEN) {
            this.player2.send(gameOverMessage);
            this.player2.close();
        }
        this.gameManager.removeGame(this);
    }

    getOtherPlayer(ws) {
        // Check if player is player1 using user ID
        const {_id} = ws.user;
        if (_id.equals(this.player1.user._id)) {
            return this.player2;
        }
        // Otherwise return player1
        return this.player1;
    }

    makeMove(ws, message) {
        // console.log(message);
        if (message.type === RESIGN) {
            this.endGame(GAME_END_MESSAGES.RESIGN, ws === this.player1 ? 'w' : 'b');
        }
        else if (message.type === MOVE && (this.chess.turn() === 'w' && ws === this.player1) || (this.chess.turn() === 'b' && ws === this.player2)) {
            try {
                this.chess.move(message.payload, {strict: true});
                this.startTurnTimer(); // Switch to next player's timer
                const other = this.getOtherPlayer(ws);
                if (other && other.readyState === other.OPEN) {
                    other.send(JSON.stringify(message));
                }
                if (this.chess.isGameOver()) {
                    let reason;
                    let loser = null;
                    if (this.chess.isCheckmate()) {
                        reason = GAME_END_MESSAGES.CHECKMATE;
                        loser = this.chess.turn();
                    }
                    else if (this.chess.isDrawByFiftyMoves()) reason = GAME_END_MESSAGES.FIFTY_MOVES;
                    else if (this.chess.isInsufficientMaterial()) reason = GAME_END_MESSAGES.INSUFFICIENT_MATERIAL;
                    else if (this.chess.isStalemate()) reason = GAME_END_MESSAGES.STALEMATE;
                    else if (this.chess.isThreefoldRepetition()) reason = GAME_END_MESSAGES.THREEFOLD_REPETITION;
                    this.endGame(reason, loser);
                }
            } 
            catch (e) {
                console.error(e);
            }
        }
    }
}

module.exports = Game;