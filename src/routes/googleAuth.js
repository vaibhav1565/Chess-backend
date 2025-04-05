const express = require('express');
const passport = require('./googleStrategy'); // Import the configured passport
const router = express.Router();

// Initiate Google OAuth
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { session: false }),
    (req, res) => {
        // Successful authentication, redirect or send token
        const { user, token } = req.user;

        // Set cookie with the token
        res.cookie('token', token, {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        });

        // Redirect to frontend with token (or send JSON)
        res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
    }
);

module.exports = router;