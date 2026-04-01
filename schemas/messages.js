let mongoose = require('mongoose');

let messageSchema = mongoose.Schema({
    from: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        required: true
    },
    to: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        required: true
    },
    messageContent: {
        type: {
            type: String,
            enum: ['file', 'text'],
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true
        }
    }
}, {
    timestamps: true
});

module.exports = new mongoose.model('message', messageSchema);
