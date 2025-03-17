const crypto = require('crypto');
const express = require('express');
const User = require('../models/user');
const bcrypt = require('bcrypt');

const generateGuestCredentials = async () => {
    // Generate a 12 digit random number
    const randomNum = Math.floor(Math.random() * 1000000000000).toString().padStart(11, '0');
    const username = `Guest${randomNum}`;

    // Generate a random password (32 characters)
    const password = crypto.randomBytes(16).toString('hex');

    return {
        username,
        password
    };
};

const router = express.Router();

router.post('/guest/signup', async (req, res) => {
    try {
        let credentials;
        let user;
        let attempts = 0;
        const maxAttempts = 5;

        // Try to create a unique guest account
        while (attempts < maxAttempts) {
            credentials = await generateGuestCredentials();
            console.log(credentials);

            // Check if username already exists
            const existingUser = await User.findOne({ username: credentials.username });
            if (!existingUser) {
                // Hash the password
                const hashedPassword = await bcrypt.hash(credentials.password, 10);
                const email = `${
                    credentials.username
                }@example.com`;

                // Create new user
                user = new User({
                    username: credentials.username,
                    password: hashedPassword,
                    email
                });

                await user.save();
                break;
            }
            attempts++;
        }

        if (!user) {
            throw new Error('Failed to create unique guest account');
        }

        // Generate JWT token
        const token = user.getJWT();
        res.cookie("token", token, {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        // Send response with safe data
        res.status(201).json({
            message: "success",
            data: {
                username: credentials.username,
                password: credentials.password, // Only sending because it's a guest account
            }
        });

    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;