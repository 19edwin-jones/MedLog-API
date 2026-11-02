// Shared test setup. Must be required before src/app so these env vars win over
// .env (dotenv never overrides variables that are already set).
process.env.JWT_SECRET = "test-secret";
process.env.DOTENV_CONFIG_QUIET = "true";
// The daily dose cap uses the server's local day boundaries; pin them to UTC so
// tests behave the same on every machine.
process.env.TZ = "UTC";

const { before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const app = require("../src/app");

const PASSWORD = "Password1!";

// Runs an in-memory MongoDB for the calling test file and empties every
// collection before each test.
function setupDatabase() {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    // Build the unique email index up front so duplicate-key tests are reliable.
    await mongoose.connection.syncIndexes();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
}

// Registers a user and returns its token, for tests that need an authenticated caller.
async function registerUser(email = "user@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD });
  return res.body.token;
}

module.exports = { app, request, setupDatabase, registerUser, PASSWORD };
