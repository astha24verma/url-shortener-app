const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis-mock');

let mongod;

module.exports = {
    setUp: async () => {
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(uri);
        }
    },

    dropDatabase: async () => {
        if (mongod) {
            await mongoose.connection.dropDatabase();
            await mongoose.connection.close();
            await mongod.stop();
        }
    },

    createMockRedis: () => new Redis(),
};
