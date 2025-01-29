const User = require('../models/user');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    try {
        const { authorization } = req.headers;

        if (!authorization) {
            return res.status(400).json({ message: 'Google OAuth 2.0 access token is required' });
        }

        const accessToken = authorization.split(' ')[1];

        const ticket = await googleClient.verifyIdToken({
            idToken: accessToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub, email, name = 'Google User', picture } = payload;

        let user = await User.findOne({ googleId: sub });
        if (!user) {
            user = new User({
                googleId: sub,
                email,
                name: name || 'Google User',
                profileImage: picture
            });
            await user.save();
        }

        const authToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            token: authToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(400).json({
            message: 'Google login failed',
            error: error.message
        });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'User retrieval failed' });
    }
};

const redis = require('ioredis');
const redisClient = new redis();

exports.logout = async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const expiration = decoded.exp - Math.floor(Date.now() / 1000);
            await redisClient.setex(`blacklist:${token}`, expiration, token);
        }
        res.json({ message: 'Logout successful' });
    } catch (error) {
        res.status(500).json({ message: 'Logout failed', error: error.message });
    }
};