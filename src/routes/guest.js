const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcrypt');

const User = require('../models/user');
const GuestCounter = require('../models/guestCounter');

const generateGuestCredentials = async () => {
    // Get and increment the counter in one atomic operation
    const counter = await GuestCounter.findOneAndUpdate(
        {},
        { $inc: { lastGuestNumber: 1 } },
        { upsert: true, new: true }
        // { upsert: true } - create document if none exists
        // { new: true } - return updated document instead of original
    );

    /*
    Model.findOneAndUpdate()
    Parameters:

    [conditions] «Object»
    [update] «Object»
    [options] «Object» optional see Query.prototype.setOptions()
    */

    // Format the number with leading zeros (10 digits)
    const guestNumber = counter.lastGuestNumber.toString().padStart(10, '0');
    const username = `Guest${guestNumber}`;

    // Generate a random password (16 characters)

    // Generate a cryptographically secure random password
    // randomBytes(8) generates 16 random bytes
    // toString('hex') converts bytes to 16 character hex string
    const password = crypto.randomBytes(8).toString('hex');

    return {
        username,
        password
    };
};

const router = express.Router();

router.post('/guest/signup', async (req, res) => {
    try {
        const credentials = await generateGuestCredentials();

        // Hash the password
        const hashedPassword = await bcrypt.hash(credentials.password, 10);

        const email = `${credentials.username}@guest.com`;

        // Create new user
        const user = new User({
            username: credentials.username,
            password: hashedPassword,
            email
        });

        await user.save();

        // Generate JWT token
        const token = user.getJWT(true);

        res.cookie('token', token, { expires: new Date(Date.now() + 10 * 60 * 60 * 1000) }); //10 hours

        // Send response with safe data
        res.status(201).json({
            data: {
                _id: user._id,
                username: user.username,
                // password: credentials.password,
                // email: user.email
                token
            }
        });

    }
    catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;