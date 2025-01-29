const express = require('express');
const router = express.Router();
const urlController = require('../controllers/url');
const { authenticateUser, rateLimitUrlCreation } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: URLs
 *     description: Endpoints for URL shortening and redirection
 *   - name: Analytics
 *     description: Endpoints for URL analytics and statistics
 * 
 * components:
 *   schemas:
 *     OsAnalytics:
 *       type: object
 *       properties:
 *         osName:
 *           type: string
 *           description: Operating system name (Windows, macOS, Linux, iOS, Android)
 *         uniqueClicks:
 *           type: integer
 *           description: Number of unique clicks for this OS
 *         uniqueUsers:
 *           type: integer
 *           description: Number of unique users for this OS
 *     DeviceAnalytics:
 *       type: object
 *       properties:
 *         deviceName:
 *           type: string
 *           description: Device type (mobile, desktop)
 *         uniqueClicks:
 *           type: integer
 *           description: Number of unique clicks for this device type
 *         uniqueUsers:
 *           type: integer
 *           description: Number of unique users for this device type
 * 
 * /api/shorten:
 *   post:
 *     summary: Create short URL
 *     tags: [URLs]
 *     description: Create a new short URL with optional custom alias and topic categorization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - longUrl
 *             properties:
 *               longUrl:
 *                 type: string
 *                 example: "https://example.com"
 *               customAlias:
 *                 type: string
 *                 example: "custom123"
 *               topic:
 *                 type: string
 *                 example: "acquisition"
 *     responses:
 *       201:
 *         description: Short URL created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shortUrl:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 * 
 * /api/{alias}:
 *   get:
 *     summary: Redirect to original URL
 *     tags: [URLs]
 *     description: Redirects to the original URL and logs analytics data
 *     parameters:
 *       - in: path
 *         name: alias
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       301:
 *         description: Redirects to original URL
 *       404:
 *         description: URL not found
 * 
 * /api/analytics/{alias}:
 *   get:
 *     summary: Get URL analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alias
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: URL analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClicks:
 *                   type: integer
 *                 uniqueUsers:
 *                   type: integer
 *                 clicksByDate:
 *                   type: array
 *                   description: Click data for the last 7 days
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                 osType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OsAnalytics'
 *                 deviceType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeviceAnalytics'
 * 
 * /api/analytics/topic/{topic}:
 *   get:
 *     summary: Get topic analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClicks:
 *                   type: integer
 *                 uniqueUsers:
 *                   type: integer
 *                 clicksByDate:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       shortUrl:
 *                         type: string
 *                       totalClicks:
 *                         type: integer
 *                       uniqueUsers:
 *                         type: integer
 * 
 * /api/analytics/overall:
 *   get:
 *     summary: Get overall analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overall analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUrls:
 *                   type: integer
 *                 totalClicks:
 *                   type: integer
 *                 uniqueUsers:
 *                   type: integer
 *                 clicksByDate:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                 osType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OsAnalytics'
 *                 deviceType:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DeviceAnalytics'
 */


// Initialize Redis in the controller
module.exports = (redis) => {
    urlController.initializeRedis(redis);

    router.get('/analytics/overall',
        authenticateUser,
        urlController.getOverallAnalytics
    );

    router.post('/shorten',
        authenticateUser,
        rateLimitUrlCreation,
        urlController.createShortUrl
    );

    router.get('/:alias', urlController.redirectUrl);

    router.get('/analytics/:alias',
        authenticateUser,
        urlController.getUrlAnalytics
    );

    router.get('/analytics/topic/:topic',
        authenticateUser,
        urlController.getTopicAnalytics
    );

    return router;
};