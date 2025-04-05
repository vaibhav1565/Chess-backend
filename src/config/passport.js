const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/user');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user already exists
            let user = await User.findOne({ email: profile.emails[0].value });

            if (!user) {
                // Generate a strong random password
                const randomPassword = crypto.randomBytes(8).toString('hex');
                const passwordHash = await bcrypt.hash(randomPassword, 10);

                // Create new user
                user = new User({
                    username: profile.displayName.replace(/\s+/g, '').toLowerCase(),
                    email: profile.emails[0].value,
                    password: passwordHash
                });

                await user.save();
            }

            // Generate JWT token
            const token = user.getJWT();

            return done(null, { user, token });
        } catch (error) {
            return done(error, false);
        }
    }
));

module.exports = passport;