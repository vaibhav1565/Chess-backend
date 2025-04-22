const jwt = require("jsonwebtoken");
const User = require("../models/user.js");

const WebSocket = require('ws');

const { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_ERROR_MESSAGES } = require('../constants');

const activeConnections = new Map();
let numberOfConnections = 0;

function handleMessage(ws, gameManager) {
    return async (message) => {
        try {
            message = JSON.parse(message.toString());

            const minutes = message?.payload?.minutes;
            const inviteCode = message?.payload?.inviteCode;

            switch (message.type) {
                case WEBSOCKET_MESSAGE_TYPES.JOIN_GAME_VIA_QUEUE: {
                    if (!minutes) {
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_MINUTES);
                    }
                    await gameManager.addPlayerViaQueue(ws, minutes);
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.JOIN_GAME_VIA_INVITE: {
                    if (!inviteCode) {
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_INVITE_CODE);
                    }
                    gameManager.addPlayerViaInvite(ws, inviteCode);
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.CREATE_INVITE_CODE: {
                    if (!minutes) {
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_MINUTES);
                    }
                    gameManager.createInvite(ws, minutes);
                    break;
                }
            }
        }
        catch (error) {
            console.error(`[WebSocket Error] ${ws.user.username}: ${error.message}`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    payload: error.message
                }));
            }
        }
    };
}

function handleClose(ws, gameManager) {
    return () => {
        activeConnections.delete(ws.user._id);
        gameManager.removePlayer(ws);
        numberOfConnections -= 1;
        console.log(`WebSocket disconnected | Total: ${numberOfConnections} | User: ${ws.user.username}`);
    };
}

async function validateConnection(token) {
    if (!token) {
        throw new Error(WEBSOCKET_ERROR_MESSAGES.INVALID_TOKEN);
    }

    const decodedObj = jwt.verify(token, process.env.SECRET_KEY);
    const { _id } = decodedObj;
    const user = await User.findById(_id);

    if (!user) {
        throw new Error(WEBSOCKET_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
}

async function handleConnection(ws, req, gameManager) {
    try {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const token = params.get('token');

        const user = await validateConnection(token);

        if (activeConnections.has(user._id.toString())) {
            console.log(`[Connection Error] ${user.username}: ${WEBSOCKET_ERROR_MESSAGES.ALREADY_CONNECTED}`);
            ws.close();
            return;
        }

        ws.user = {
            username: user.username,
            email: user.email,
            _id: user._id.toString()
        };
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ [WEBSOCKET_MESSAGE_TYPES.CONNECTION_SUCCESS]: true }));
        }

        numberOfConnections += 1;
        console.log(`WebSocket connected | Total: ${numberOfConnections} | User: ${ws.user.username}`);
        activeConnections.set(ws.user._id, ws);

        ws.on('message', handleMessage(ws, gameManager));
        ws.on('close', handleClose(ws, gameManager, user));
    } catch (error) {
        console.error(`[Connection Error] ${error.message}`);
        ws.close();
    }
}

module.exports = { handleConnection };