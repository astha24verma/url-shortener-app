const mongoose = require('mongoose');

const urlAnalyticSchema = new mongoose.Schema({
    url: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Url',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    geolocation: {
        country: String,
        city: String,
        latitude: Number,
        longitude: Number
    },
    osType: {
        type: String
    },
    deviceType: {
        type: String
    }
}, {
    timestamps: true,
    indexes: [
        { url: 1, timestamp: -1 },
        { timestamp: -1 }
    ]
});


module.exports = mongoose.model('Analytics', urlAnalyticSchema);
