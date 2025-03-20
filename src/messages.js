const INIT_GAME = "init_game";
const CREATE_INVITE_CODE = "create_invite_code";
const GAME_BEGIN = "game_begin";
const MOVE = "move";
const ASSIGN_COLOR = "assign_color";
const DISCONNECT = "disconnect";
const RESIGN = "resign";
const OPPONENT_DISCONNECT = "opponent_disconnect";

const GAME_OVER_MESSAGES = {
    CHECKMATE: "checkmate",
    FIFTY_MOVES: "fifty_moves",
    INSUFFICIENT_MATERIAL: "insufficient_material",
    STALEMATE: "stalemate",
    THREEFOLD_REPETITION: "threefold_repetition",
    RESIGN: "resign",
    TIMEOUT: "timeout",
    OPPONENT_DISCONNECT: "opponent_disconnect",
    ABORT: "abort"
}

module.exports = {INIT_GAME, CREATE_INVITE_CODE, GAME_BEGIN, MOVE, ASSIGN_COLOR, DISCONNECT, RESIGN, OPPONENT_DISCONNECT, GAME_OVER_MESSAGES};