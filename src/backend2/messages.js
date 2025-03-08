const MOVE = "move";
const ASSIGN_COLOR = "assign_color";
const DISCONNECT = "disconnect";
const RESIGN = "resign";

const PLAY_WITH_FRIEND = "playWithFriend";

const GAME_END_MESSAGES = {
    CHECKMATE: "checkmate",
    FIFTY_MOVES: "fifty_moves",
    INSUFFICIENT_MATERIAL: "insufficient_material",
    STALEMATE: "stalemate",
    THREEFOLD_REPETITION: "threefold_repetition",
    RESIGN: "resign",
    TIMEOUT: "timeout"
}

module.exports = {MOVE, ASSIGN_COLOR, DISCONNECT, RESIGN, PLAY_WITH_FRIEND, GAME_END_MESSAGES};