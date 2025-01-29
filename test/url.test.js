const request = require('supertest');
const { expect } = require('chai');
const app = require('../index');
const { setUp, dropDatabase, createMockRedis } = require('./setup');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

describe('URL Routes', () => {
    let token;
    let user;
    const redis = createMockRedis();

    before(async () => {
        await setUp();
        user = new User({
            name: 'Test User',
            email: 'test@test.com',
            googleId: '12345'
        });
        await user.save();
        token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    });

    after(dropDatabase);

    describe('POST /api/shorten', () => {
        it('should create a short URL', async () => {
            const res = await request(app)
                .post('/api/shorten')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    longUrl: 'https://example.com',
                    topic: 'activation'
                })
                .expect(201);

            expect(res.body).to.have.property('shortUrl');
            expect(res.body).to.have.property('createdAt');
        });
    });

    describe('GET /api/analytics/overall', () => {
        it('should return overall analytics', async () => {
            const res = await request(app)
                .get('/api/analytics/overall')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).to.have.property('totalUrls');
            expect(res.body).to.have.property('totalClicks');
            expect(res.body).to.have.property('uniqueUsers');
        });
    });
});