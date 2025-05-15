const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const WebSocket = require('ws');
const { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_ERROR_MESSAGES } = require('../chessConstants');

const activeConnections = new Map();
let numberOfConnections = 0;

function handleClose(ws, gameManager) {
    return () => {
        console.group('[HANDLE CLOSE]');
        if (!ws.user?._id) {
            console.log('Uninitialized connection closed');
            console.groupEnd();
            return;
        }
        console.log(`User disconnecting: ${ws.user.username}`);
        activeConnections.delete(ws.user._id);
        gameManager.removePlayer(ws);
        numberOfConnections--;
        console.log(`Total connections after disconnect: ${numberOfConnections}`);
        console.groupEnd();
    };
}

async function handleConnection(ws, req, gameManager) {
    console.group('[HANDLE CONNECTION]');
    try {
        const params = new URLSearchParams((req.url.split('?')[1] || ''));
        const token = params.get('token');

        if (!token) {
            console.log('No token provided');
            ws.send(JSON.stringify({
                type: WEBSOCKET_MESSAGE_TYPES.ERROR,
                payload: WEBSOCKET_ERROR_MESSAGES.INVALID_TOKEN
            }));
            ws.close();
            console.groupEnd();
            return;
        }

        const user = await validateConnection(token);

        if (activeConnections.has(user._id.toString())) {
            console.log('User already connected:', user.username);
            ws.close();
            console.groupEnd();
            return;
        }

        ws.user = {
            username: user.username,
            email: user.email,
            _id: user._id.toString()
        };

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: WEBSOCKET_MESSAGE_TYPES.CONNECTION_SUCCESS,
            }));
        }

        numberOfConnections += 1;
        activeConnections.set(ws.user._id, ws);
        console.log(`New connection established | Total: ${numberOfConnections} | User: ${ws.user.username}`);

        ws.on('message', handleMessage(ws, gameManager));
        ws.on('close', handleClose(ws, gameManager));

    } catch (error) {
        console.log('Connection error:', error.message);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: WEBSOCKET_MESSAGE_TYPES.ERROR,
                payload: error.message
            }));
        }
        ws.close();
    }
    console.groupEnd();
}

function handleMessage(ws, gameManager) {
    return async (message) => {
        console.group('[HANDLE MESSAGE]');
        try {
            message = JSON.parse(message.toString());
            console.log('Received message:', message);

            const timeConfig = message?.payload?.timeConfig;
            const inviteCode = message?.payload?.inviteCode;

            switch (message.type) {
                case WEBSOCKET_MESSAGE_TYPES.JOIN_GAME_VIA_QUEUE: {
                    console.group('[JOIN GAME VIA QUEUE]');
                    if (! timeConfig || timeConfig.minutes === undefined || timeConfig.increment === undefined) {
                        console.log("Missing time config");
                        console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_TIMECONFIG);
                    }
                    console.log('Time config:', timeConfig);
                    await gameManager.addPlayerViaQueue(ws, timeConfig);
                    console.groupEnd();
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.JOIN_GAME_VIA_INVITE: {
                    console.group('[JOIN GAME VIA INVITE]');
                    if (!inviteCode) {
                        console.log('Missing invite code');
                        console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_INVITE_CODE);
                    }
                    console.log('Invite code:', inviteCode);
                    gameManager.addPlayerViaInvite(ws, inviteCode);
                    console.groupEnd();
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.CREATE_INVITE_CODE: {
                    console.group('[CREATE INVITE CODE]');
                    if (!timeConfig || timeConfig.minutes === undefined || timeConfig.increment === undefined) {
                        console.log("Missing time config");
                        console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_TIMEPERIOD);
                    }
                    console.log('Time config:', timeConfig);
                    gameManager.createInviteCode(ws, timeConfig);
                    console.groupEnd();
                    break;
                }

                default: {
                    console.log("Unknown message type-", message.type);
                }
            }
        }
        catch (error) {
            console.log(`[WebSocket Error] ${ws?.user?.username}: ${error.message}`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: WEBSOCKET_MESSAGE_TYPES.ERROR,
                    payload: error.message
                }));
            }
        }
        console.groupEnd();
    };
}

async function validateConnection(token) {
    console.group('[VALIDATE CONNECTION]');
    if (!token) {
        console.log('No token provided');
        throw new Error(WEBSOCKET_ERROR_MESSAGES.INVALID_TOKEN);
    }

    const decodedObj = jwt.verify(token, process.env.SECRET_KEY);
    const { _id } = decodedObj;

    console.log('Finding user by ID:', _id);
    const user = await User.findById(_id);

    if (!user) {
        console.log('User not found');
        throw new Error(WEBSOCKET_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    console.log('User validated:', user.username);
    console.groupEnd();
    return user;
}

module.exports = { handleConnection };