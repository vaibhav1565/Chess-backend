const jwt = require("jsonwebtoken");
const User = require("../models/user.js");

const activeConnections = new Map();
let numberOfConnections = 0;

function handleMessage(ws, gameManager) {
    return async (message) => {
        // console.log(message.toString());
        try {
            message = JSON.parse(message.toString());

            const minutes = message?.payload?.minutes;
            const inviteCode = message?.payload?.inviteCode;

            switch (message.type) {
                case "init_game": {
                    if (inviteCode) {
                        gameManager.addPlayerViaInvite(ws, inviteCode);
                    }
                    else if (minutes) {
                        gameManager.addPlayerViaQueue(ws, minutes);
                    }
                    break;
                }
                case "create_invite_code": {
                    if (minutes) {
                        gameManager.createInvite(ws, minutes);
                    }
                    break;
                }
            }
        }
        catch (e) {
            console.log("ERROR", e);
        }
    };
}

function handleClose(ws, gameManager) {
    return () => {
        activeConnections.delete(ws.user._id);
        gameManager.removePlayer(ws);
        numberOfConnections -= 1;
        console.log("Disconnected", numberOfConnections);
    };
}

async function handleConnection(ws, req, gameManager) {
    try {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const token = params.get('token');
        if (!token) {
            throw new Error("Token is not valid");
        }

        const decodedObj = jwt.verify(token, process.env.SECRET_KEY);
        const { _id } = decodedObj;
        const user = await User.findById(_id);

        if (!user) {
            throw new Error("User not found");
        }

        if (activeConnections.has(user._id.toString())) {
            ws.close();
            return;
        }

        ws.user = {...user.toObject(), _id: user._id.toString()};
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ success: true }));
        }

        numberOfConnections += 1;
        console.log(numberOfConnections, "Connected", ws.user.username);
        activeConnections.set(ws.user._id, ws);

        ws.on('message', handleMessage(ws, gameManager));
        ws.on('close', handleClose(ws, gameManager, user));
    } catch (e) {
        ws.close();
        console.log("ERROR", e);
    }
}

module.exports = { handleConnection };