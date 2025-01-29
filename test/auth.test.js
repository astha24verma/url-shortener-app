const request = require('supertest');
const { expect } = require('chai');
const app = require('../index');
const { setUp, dropDatabase } = require('./setup');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const sinon = require('sinon');
const { OAuth2Client } = require('google-auth-library');

describe('Auth Routes', () => {
    before(setUp);
    after(dropDatabase);

    let verifyIdTokenStub;

    before(() => {
        verifyIdTokenStub = sinon.stub(OAuth2Client.prototype, 'verifyIdToken').resolves({
            getPayload: () => ({ sub: '12345', email: 'test@test.com' })
        });
    });

    after(() => {
        if (verifyIdTokenStub) {
            verifyIdTokenStub.restore();
        }
    });

    describe('POST /auth/google', () => {
        it('should login user with valid Google token', async () => {
            const mockGoogleToken = 'your-mocked-token';
            const res = await request(app)
                .post('/auth/google')
                .set('Authorization', `Bearer ${mockGoogleToken}`)
                .expect(200);

            expect(res.body).to.have.property('token');
            expect(res.body).to.have.property('user');
        });
    });

    describe('GET /auth/me', () => {
        let token;
        let user;

        before(async () => {
            user = new User({
                name: 'Test User',
                email: 'test@test.com',
                googleId: '12345'
            });
            await user.save();
            token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        });

        it('should return user profile for authenticated user', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body.email).to.equal('test@test.com');
        });
    });
});
