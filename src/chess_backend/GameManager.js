import Game from "./Game.js";
import { DISCONNECT } from "./messages.js";

class GameManager {
    constructor() {
        this.waitingUser = null;
        this.games = [];
    }

    removeGame(game) {
        const index = this.games.indexOf(game);
        if (index > -1) this.games.splice(index, 1);
    }

    findGameByPlayer(ws) {
        return this.games.find(game => game.player1 === ws || game.player2 === ws);
    }

    addPlayer(ws) {
        if (!this.waitingUser || this.waitingUser.readyState !== this.waitingUser.OPEN) {
            this.waitingUser = null;
        }
        if (!this.waitingUser) {
            this.waitingUser = ws;
        } else {
            const newGame = new Game(this.waitingUser, ws, this);
            this.games.push(newGame);
            this.attachMessageHandler(this.waitingUser);
            this.attachMessageHandler(ws);

            this.waitingUser = null;
        }
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
            catch {}
        })
    }
}

export default GameManager;

/*
Closing or closed state
Race Conditions:
There is no locking mechanism to prevent race conditions when modifying shared state (e.g., this.waitingUser or this.games). In a high-concurrency environment, this could lead to issues.
Fix: Use a mutex or similar mechanism to ensure thread-safe operations.
Error Handling:
The try-catch block in attachMessageHandler is empty, meaning errors during message parsing or handling are silently ignored. This makes debugging difficult.
Fix: Log the error or handle it appropriately (e.g., notify the player of invalid input).
*/