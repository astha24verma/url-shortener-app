const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
    longUrl: {
        type: String,
        required: true
    },
    alias: {
        type: String,
        unique: true
    },
    topic: {
        type: String,
        enum: ['acquisition', 'activation', 'retention'],
        default: 'acquisition'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    clicks: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Url', urlSchema);
