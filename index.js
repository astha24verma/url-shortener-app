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

    const redisConfig = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || 'redis',
            port: process.env.REDIS_PORT || 6379
        };

    redis = new Redis({
        ...redisConfig,
        maxRetriesPerRequest: 5,
        retryStrategy(times) {
            if (times >= 5) {
                console.error('Max retries reached. Could not connect to Redis.');
                return null; // Stop retrying after 5 attempts
            }
            const delay = Math.min(times * 1000, 10000);
            console.log(`Retrying Redis connection in ${delay}ms...`);
            return delay;
        },
    });
}

redis.on('error', (err) => {
    console.error('Redis Error:', err.message);
});

redis.on('connect', () => {
    console.log('✅ Redis Connected!');
});


// Routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', authRoutes(redis));
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
