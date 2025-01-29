const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const useragent = require('express-useragent');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const urlRoutes = require('./routes/url');
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(useragent.express());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.error('MongoDB Connection Error:', err));

// Conditionally use real Redis or a mock for tests
let redis;
if (process.env.NODE_ENV === 'test') {
    const RedisMock = require('ioredis-mock');
    redis = new RedisMock();
    console.log('Using mock Redis for testing');
} else {
    const Redis = require('ioredis');
    redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        showFriendlyErrorStack: false,
        retryStrategy(times) {
            const maxDelay = 5000; // Maximum delay of 5 seconds
            const delay = Math.min(times * 500, maxDelay);
            console.log(`Retrying Redis connection in ${delay}ms...`);
            return delay;
        },
        maxRetriesPerRequest: 20
    });

    redis.on('connect', () => console.log('Redis Connected'));
    redis.on('error', (err) => console.error('Redis Error:', err.message));
}


// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', authRoutes);
app.use('/api', urlRoutes(redis));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Start Server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export app for testing
module.exports = app;
