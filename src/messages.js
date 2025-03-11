const INIT_GAME = "init_game";
const MOVE = "move";
const ASSIGN_COLOR = "assign_color";
const DISCONNECT = "disconnect";
const RESIGN = "resign";

const GAME_END_MESSAGES = {
    CHECKMATE: "checkmate",
    FIFTY_MOVES: "fifty_moves",
    INSUFFICIENT_MATERIAL: "insufficient_material",
    STALEMATE: "stalemate",
    THREEFOLD_REPETITION: "threefold_repetition",
    RESIGN: "resign",
    TIMEOUT: "timeout"
}

module.exports = {INIT_GAME, MOVE, ASSIGN_COLOR, DISCONNECT, RESIGN, GAME_END_MESSAGES};