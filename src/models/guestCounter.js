const mongoose = require('mongoose');

const guestCounterSchema = new mongoose.Schema({
    lastGuestNumber: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('GuestCounter', guestCounterSchema);