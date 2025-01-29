const URL = require('../models/url');
const Analytics = require('../models/analytics');
const { nanoid } = require('nanoid');
const geoip = require('geoip-lite');

// Redis client is already configured in app.js, you'll receive it through dependency injection
let redis;

// Initialize Redis client
const initializeRedis = (redisClient) => {
    redis = redisClient;
};

const CACHE_DURATION = 6 * 60 * 60; // 6 hours in seconds

exports.createShortUrl = async (req, res) => {
    try {
        const { longUrl, customAlias, topic } = req.body;
        const alias = customAlias || nanoid(8);

        const existingUrl = await URL.findOne({ alias });
        if (existingUrl) {
            return res.status(400).json({ error: 'Alias already in use' });
        }

        const newUrl = new URL({
            longUrl,
            alias,
            topic: topic || 'acquisition',
            createdBy: req.user._id
        });

        await newUrl.save();

        // Cache the new URL mapping
        await redis.setex(`url:${alias}`, CACHE_DURATION, longUrl);

        res.status(201).json({
            shortUrl: `${req.protocol}://${req.get('host')}/api/${alias}`,
            createdAt: newUrl.createdAt
        });
    } catch (error) {
        console.error("URL Creation Error:", error);
        res.status(500).json({
            error: 'Error creating short URL',
            details: error.message
        });
    }
};

exports.redirectUrl = async (req, res) => {
    try {
        const { alias } = req.params;

        // Try to get the URL from cache first
        const cachedUrl = await redis.get(`url:${alias}`);
        let longUrl;

        if (cachedUrl) {
            longUrl = cachedUrl;
        } else {
            // If not in cache, get from database
            const url = await URL.findOne({ alias });
            if (!url) return res.status(404).json({ error: 'URL not found' });

            longUrl = url.longUrl;
            // Cache the URL for future requests
            await redis.setex(`url:${alias}`, CACHE_DURATION, longUrl);
        }

        // Update analytics asynchronously
        updateAnalytics(alias, req).catch(console.error);

        res.redirect(longUrl);
    } catch (error) {
        console.error('Redirect Error:', error);
        res.status(500).json({ error: 'Redirect error' });
    }
};

exports.getUrlAnalytics = async (req, res) => {
    try {
        const { alias } = req.params;
        const cacheKey = `analytics:${alias}:${req.user._id}`;

        const cachedAnalytics = await redis.get(cacheKey);
        if (cachedAnalytics) {
            return res.json(JSON.parse(cachedAnalytics));
        }

        const url = await URL.findOne({ alias, createdBy: req.user._id });
        if (!url) {
            return res.status(404).json({ error: 'URL not found' });
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [uniqueUsersResult, clicksByDate, osTypeData, deviceTypeData] = await Promise.all([
            Analytics.aggregate([
                { $match: { url: url._id } },
                { $group: { _id: '$ipAddress' } },
                { $count: 'uniqueUsers' }
            ]),
            Analytics.aggregate([
                {
                    $match: {
                        url: url._id,
                        timestamp: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Analytics.aggregate([
                { $match: { url: url._id } },
                {
                    $group: {
                        _id: '$osType',
                        uniqueClicks: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$ipAddress' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        osName: '$_id',
                        uniqueClicks: 1,
                        uniqueUsers: { $size: '$uniqueUsers' }
                    }
                }
            ]),
            Analytics.aggregate([
                { $match: { url: url._id } },
                {
                    $group: {
                        _id: '$deviceType',
                        uniqueClicks: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$ipAddress' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        deviceName: '$_id',
                        uniqueClicks: 1,
                        uniqueUsers: { $size: '$uniqueUsers' }
                    }
                }
            ])
        ]);

        const analytics = {
            totalClicks: url.clicks || 0,
            uniqueUsers: uniqueUsersResult[0]?.uniqueUsers || 0,
            clicksByDate: clicksByDate || [],
            osType: osTypeData || [],
            deviceType: deviceTypeData || []
        };

        // Cache analytics for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(analytics));

        res.json(analytics);
    } catch (error) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: 'Analytics retrieval error', details: error.message });
    }
};

exports.getTopicAnalytics = async (req, res) => {
    try {
        const { topic } = req.params;
        const cacheKey = `topic:${topic}:${req.user._id}`;

        // Try to get topic analytics from cache
        const cachedAnalytics = await redis.get(cacheKey);
        if (cachedAnalytics) {
            return res.json(JSON.parse(cachedAnalytics));
        }

        const urls = await URL.find({ topic, createdBy: req.user._id });
        if (!urls || urls.length === 0) {
            return res.status(404).json({ error: 'No URLs found for the specified topic' });
        }

        const urlIds = urls.map(url => url._id);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [uniqueUsersResult, clicksByDate, urlAnalytics] = await Promise.all([
            Analytics.aggregate([
                { $match: { url: { $in: urlIds } } },
                { $group: { _id: '$ipAddress' } },
                { $count: 'uniqueUsers' }
            ]),
            Analytics.aggregate([
                {
                    $match: {
                        url: { $in: urlIds },
                        timestamp: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Promise.all(urls.map(async (url) => {
                const uniqueUsersCount = await Analytics.aggregate([
                    { $match: { url: url._id } },
                    { $group: { _id: '$ipAddress' } },
                    { $count: 'count' }
                ]);

                return {
                    shortUrl: url.alias,
                    totalClicks: url.clicks,
                    uniqueUsers: uniqueUsersCount[0]?.count || 0
                };
            }))
        ]);

        const response = {
            totalClicks: urls.reduce((sum, url) => sum + url.clicks, 0),
            uniqueUsers: uniqueUsersResult[0]?.uniqueUsers || 0,
            clicksByDate: clicksByDate.map(item => ({
                date: item._id,
                count: item.count
            })),
            urls: urlAnalytics
        };

        // Cache topic analytics for 30 minutes
        await redis.setex(cacheKey, 1800, JSON.stringify(response));

        res.json(response);
    } catch (error) {
        console.error('Topic analytics error:', error);
        res.status(500).json({ error: 'Topic analytics error', details: error.message });
    }
};

exports.getOverallAnalytics = async (req, res) => {
    try {
        const cacheKey = `overall:${req.user._id}`;

        const cachedAnalytics = await redis.get(cacheKey);
        if (cachedAnalytics) {
            return res.json(JSON.parse(cachedAnalytics));
        }

        const urls = await URL.find({ createdBy: req.user._id });

        if (!urls || urls.length === 0) {
            const emptyResponse = {
                totalUrls: 0,
                totalClicks: 0,
                uniqueUsers: 0,
                clicksByDate: [],
                osType: [],
                deviceType: []
            };
            await redis.setex(cacheKey, 1800, JSON.stringify(emptyResponse));
            return res.status(200).json(emptyResponse);
        }

        const urlIds = urls.map(url => url._id);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [uniqueUsersResult, clicksByDate, osType, deviceType] = await Promise.all([
            Analytics.aggregate([
                { $match: { url: { $in: urlIds } } },
                { $group: { _id: '$ipAddress' } },
                { $count: 'uniqueUsers' }
            ]),
            Analytics.aggregate([
                {
                    $match: {
                        url: { $in: urlIds },
                        timestamp: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Analytics.aggregate([
                { $match: { url: { $in: urlIds } } },
                {
                    $group: {
                        _id: '$osType',
                        uniqueClicks: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$ipAddress' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        osName: '$_id',
                        uniqueClicks: 1,
                        uniqueUsers: { $size: '$uniqueUsers' }
                    }
                }
            ]),
            Analytics.aggregate([
                { $match: { url: { $in: urlIds } } },
                {
                    $group: {
                        _id: '$deviceType',
                        uniqueClicks: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$ipAddress' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        deviceName: '$_id',
                        uniqueClicks: 1,
                        uniqueUsers: { $size: '$uniqueUsers' }
                    }
                }
            ])
        ]);


        const response = {
            totalUrls: urls.length,
            totalClicks: urls.reduce((sum, url) => sum + (url.clicks || 0), 0),
            uniqueUsers: uniqueUsersResult[0]?.uniqueUsers || 0,
            clicksByDate: clicksByDate || [],
            osType: osType || [],
            deviceType: deviceType || []
        };

        // Cache overall analytics for 30 minutes
        await redis.setex(cacheKey, 1800, JSON.stringify(response));

        res.json(response);
    } catch (error) {
        console.error('Error in getOverallAnalytics:', error);
        res.status(500).json({ error: 'Overall analytics error', details: error.message });
    }
};

// Add this function to help manage cache invalidation
async function invalidateUserCaches(userId, alias) {
    const keys = [
        `analytics:${alias}:${userId}`,
        `overall:${userId}`
    ];

    // Get all topic-related keys for this user
    const topicKeys = await redis.keys(`topic:*:${userId}`);
    keys.push(...topicKeys);

    // Delete all related caches
    if (keys.length > 0) {
        await redis.del(keys);
    }
}

// Update the existing updateAnalytics function to use the new invalidation
async function updateAnalytics(alias, req) {
    const url = await URL.findOne({ alias });
    if (!url) return;
    const clientIp = req.ip === '::1' ? '127.0.0.1' : req.ip;
    const geoInfo = geoip.lookup(clientIp) || {};

    const analyticsEntry = new Analytics({
        url: url._id,
        timestamp: Date.now(),
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        geolocation: {
            country: geoInfo.country || 'Unknown',
            city: geoInfo.city || 'Unknown',
            latitude: geoInfo.ll?.[0],
            longitude: geoInfo.ll?.[1]
        },
        osType: req.useragent.os || 'Unknown',
        deviceType: req.useragent.isMobile ? 'mobile' : 'desktop'
    });

    await analyticsEntry.save();
    url.clicks += 1;
    await url.save();

    // Invalidate analytics cache when new data is added
    const cacheKey = `analytics:${alias}:${url.createdBy}`;
    await redis.del(cacheKey);
    await invalidateUserCaches(url.createdBy, alias);
}

// Export the initialize function
exports.initializeRedis = initializeRedis;