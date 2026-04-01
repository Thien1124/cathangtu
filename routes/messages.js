let express = require('express');
let router = express.Router();
let mongoose = require('mongoose');
let multer = require('multer');
let path = require('path');

let { CheckLogin } = require('../utils/authHandler');
let messageModel = require('../schemas/messages');
let userModel = require('../schemas/users');

let storageSetting = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let filename = Date.now() + '-' + Math.round(Math.random() * 1000_000_000) + ext;
        cb(null, filename);
    }
});

let uploadMessageFile = multer({
    storage: storageSetting,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;

        let messages = await messageModel.aggregate([
            {
                $match: {
                    $or: [
                        { from: currentUserId },
                        { to: currentUserId }
                    ]
                }
            },
            {
                $addFields: {
                    partnerUser: {
                        $cond: [{ $eq: ['$from', currentUserId] }, '$to', '$from']
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $group: {
                    _id: '$partnerUser',
                    lastMessage: { $first: '$$ROOT' }
                }
            },
            {
                $replaceRoot: {
                    newRoot: '$lastMessage'
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        await messageModel.populate(messages, [
            {
                path: 'from',
                select: '_id username fullName avatarUrl'
            },
            {
                path: 'to',
                select: '_id username fullName avatarUrl'
            }
        ]);

        res.send(messages);
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
    }
});

router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let otherUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            res.status(404).send({
                message: 'userID khong hop le'
            });
            return;
        }

        let checkUser = await userModel.findOne({
            _id: otherUserId,
            isDeleted: false
        });
        if (!checkUser) {
            res.status(404).send({
                message: 'user khong ton tai'
            });
            return;
        }

        let messages = await messageModel.find({
            $or: [
                {
                    from: currentUserId,
                    to: otherUserId
                },
                {
                    from: otherUserId,
                    to: currentUserId
                }
            ]
        }).sort({ createdAt: 1 }).populate('from to', '_id username fullName avatarUrl');

        res.send(messages);
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
    }
});

router.post('/', CheckLogin, uploadMessageFile.single('file'), async function (req, res, next) {
    try {
        let from = req.user._id;
        let { to, text } = req.body;

        if (!to || !mongoose.Types.ObjectId.isValid(to)) {
            res.status(404).send({
                message: 'to khong hop le'
            });
            return;
        }

        let checkUser = await userModel.findOne({
            _id: to,
            isDeleted: false
        });
        if (!checkUser) {
            res.status(404).send({
                message: 'user nhan khong ton tai'
            });
            return;
        }

        let messageType = 'text';
        let messageText = (text || '').trim();

        if (req.file) {
            messageType = 'file';
            messageText = req.file.path;
        }

        if (!messageText) {
            res.status(404).send({
                message: 'noi dung khong duoc de trong'
            });
            return;
        }

        let newMessage = new messageModel({
            from: from,
            to: to,
            messageContent: {
                type: messageType,
                text: messageText
            }
        });

        await newMessage.save();
        await newMessage.populate('from to', '_id username fullName avatarUrl');

        res.send(newMessage);
    } catch (error) {
        res.status(400).send({
            message: error.message
        });
    }
});

module.exports = router;
