const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const WebSocket = require('ws');
const { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_ERROR_MESSAGES } = require('../chessConstants');

const activeConnections = new Map();
let numberOfConnections = 0;

function handleClose(ws, gameManager) {
    return () => {
        console.group('[HANDLE CLOSE]');
        console.log(`User disconnecting: ${ws.user.username}`);
        gameManager.removePlayer(ws);
        activeConnections.delete(ws.user._id);
        numberOfConnections--;
        console.log(`Total connections after disconnect: ${numberOfConnections}`);
        printUsers();
        console.log("#################")
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
            console.log("#################")

            console.groupEnd();
            return;
        }

        const user = await validateConnection(token);

        const existingUser = activeConnections.get(user._id.toString());
        if (existingUser) {
            console.log("User already connected, closing previous connection");
            existingUser.close();
            numberOfConnections--;
            activeConnections.delete(user._id.toString());
            gameManager.removePlayer(existingUser);
            console.log(`Total connections after disconnect: ${numberOfConnections}`);
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
        printUsers();

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
    console.log("#################")
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
                    console.log('[JOIN GAME VIA QUEUE]');
                    if (!timeConfig || timeConfig.minutes === undefined || timeConfig.increment === undefined) {
                        console.log("Missing time config");
                        // console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_TIMECONFIG);
                    }
                    await gameManager.addPlayerViaQueue(ws, timeConfig);
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.JOIN_GAME_VIA_INVITE: {
                    console.log('[JOIN GAME VIA INVITE]');
                    if (!inviteCode) {
                        console.log('Missing invite code');
                        // console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_INVITE_CODE);
                    }
                    gameManager.addPlayerViaInvite(ws, inviteCode);
                    break;
                }
                case WEBSOCKET_MESSAGE_TYPES.CREATE_INVITE_CODE: {
                    console.log('[CREATE INVITE CODE]');
                    if (!timeConfig || timeConfig.minutes === undefined || timeConfig.increment === undefined) {
                        console.log("Missing time config");
                        // console.groupEnd();
                        throw new Error(WEBSOCKET_ERROR_MESSAGES.MISSING_TIMEPERIOD);
                    }
                    gameManager.createInviteCode(ws, timeConfig);
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
        finally {
            console.log("#################")
            console.groupEnd();
        }
    };
}

function printUsers() {
    const keys = activeConnections.keys();
    while (true) {
        const key = keys.next().value;
        if (!key) break;
        console.log(key);
    }
}

async function validateConnection(token) {
    console.group('[VALIDATE CONNECTION]');

    const decodedObj = jwt.verify(token, process.env.SECRET_KEY);
    const { _id } = decodedObj;

    console.log('Finding user by ID:', _id);
    const user = await User.findById(_id);

    if (!user) {
        console.log('User not found');
        throw new Error(WEBSOCKET_ERROR_MESSAGES.USER_NOT_FOUND);
    }

    console.log("#################")

    console.groupEnd();
    return user;
}

module.exports = { handleConnection };