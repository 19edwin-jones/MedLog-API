const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { app, request, setupDatabase, registerUser, PASSWORD } = require("./helpers");

setupDatabase();

describe("POST /api/auth/register", () => {
  it("creates a user and returns a token whose sub is the user id", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "user@example.com", password: PASSWORD });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "user@example.com");
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(payload.sub, res.body.user.id);
  });

  it("never returns the password hash", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "user@example.com", password: PASSWORD });

    assert.equal(JSON.stringify(res.body).includes("passwordHash"), false);
  });

  it("normalizes the email to lowercase", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "  User@Example.COM ", password: PASSWORD });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "user@example.com");
  });

  it("rejects an email that is already registered, ignoring case", async () => {
    await registerUser("user@example.com");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "USER@example.com", password: PASSWORD });

    assert.equal(res.status, 409);
  });

  it("returns 409 for one of two simultaneous registrations with the same email", async () => {
    const send = () =>
      request(app)
        .post("/api/auth/register")
        .send({ email: "race@example.com", password: PASSWORD });
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();

    assert.deepEqual(statuses, [201, 409]);
  });

  const invalidBodies = [
    ["no body", undefined],
    ["missing password", { email: "user@example.com" }],
    ["non-string email", { email: { $gt: "" }, password: PASSWORD }],
    ["short password", { email: "user@example.com", password: "Pa1!" }],
    ["no uppercase", { email: "user@example.com", password: "password1!" }],
    ["no number", { email: "user@example.com", password: "Password!" }],
    ["no special character", { email: "user@example.com", password: "Password1" }],
  ];
  for (const [name, body] of invalidBodies) {
    it(`returns 400 for ${name}`, async () => {
      const res = await request(app).post("/api/auth/register").send(body);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.error, "string");
    });
  }
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials, with any email casing", async () => {
    await registerUser("user@example.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "User@Example.com", password: PASSWORD });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await registerUser("user@example.com");
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com", password: "Wrong1!pass" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  it("returns 400 for an object email instead of running it as a query", async () => {
    await registerUser("user@example.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $gt: "" }, password: PASSWORD });

    assert.equal(res.status, 400);
  });

  it("returns 400 when there is no body", async () => {
    const res = await request(app).post("/api/auth/login");
    assert.equal(res.status, 400);
  });
});

describe("JWT middleware", () => {
  const cases = [
    ["no Authorization header", undefined],
    ["a non-Bearer scheme", "Basic abc"],
    ["a malformed token", "Bearer not-a-jwt"],
    ["a token signed with another secret", `Bearer ${jwt.sign({ sub: "x" }, "other-secret")}`],
    ["an expired token", `Bearer ${jwt.sign({ sub: "x" }, "test-secret", { expiresIn: -1 })}`],
  ];
  for (const [name, header] of cases) {
    it(`returns 401 for ${name}`, async () => {
      const req = request(app).get("/api/medlogs");
      if (header) req.set("Authorization", header);
      const res = await req;
      assert.equal(res.status, 401);
    });
  }
});

describe("error handling", () => {
  it("returns a JSON 400 for malformed JSON, without a stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad");

    assert.equal(res.status, 400);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.equal(JSON.stringify(res.body).includes("node_modules"), false);
  });
});
