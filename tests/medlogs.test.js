const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { app, request, setupDatabase, registerUser } = require("./helpers");

setupDatabase();

let token;
let otherToken;

beforeEach(async () => {
  token = await registerUser("user@example.com");
  otherToken = await registerUser("other@example.com");
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function createLog(t, overrides = {}) {
  return request(app)
    .post("/api/medlogs")
    .set(auth(t))
    .send({
      medication: "Ibuprofen",
      doseMg: 200,
      takenAt: "2026-11-01T09:00:00Z",
      ...overrides,
    });
}

describe("POST /api/medlogs", () => {
  it("accepts the payload Apple Shortcuts sends, with doseMg as a string", async () => {
    const res = await request(app)
      .post("/api/medlogs")
      .set(auth(token))
      .send({
        medication: "Adderall",
        doseMg: "10",
        takenAt: "2026-10-31T15:43:30-04:00",
        notes: "[Shortcuts] No reminder set",
      });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.doseMg, 10);
    assert.equal(res.body.takenAt, "2026-10-31T19:43:30.000Z");
    assert.equal(res.body.notes, "[Shortcuts] No reminder set");
  });

  it("ignores a userId in the body and uses the token's user", async () => {
    const otherId = new mongoose.Types.ObjectId().toString();
    const res = await createLog(token, { userId: otherId });

    assert.equal(res.status, 201);
    assert.notEqual(res.body.userId, otherId);
  });

  const invalid = [
    ["no body", null],
    ["missing medication", { medication: undefined }],
    ["missing doseMg", { doseMg: undefined }],
    ["missing takenAt", { takenAt: undefined }],
    ["blank medication", { medication: "   " }],
    ["non-string medication", { medication: ["Ibuprofen"] }],
    ["zero dose", { doseMg: 0 }],
    ["negative dose", { doseMg: -5 }],
    ["non-numeric string dose", { doseMg: "abc" }],
    ["boolean dose", { doseMg: true }],
    ["invalid date", { takenAt: "not a date" }],
    ["non-string notes", { notes: { text: "hi" } }],
  ];
  for (const [name, overrides] of invalid) {
    it(`returns 400 for ${name}`, async () => {
      const res =
        overrides === null
          ? await request(app).post("/api/medlogs").set(auth(token))
          : await createLog(token, overrides);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.error, "string");
    });
  }
});

describe("daily dose cap", () => {
  it("allows 2 doses on the same day and rejects a 3rd", async () => {
    assert.equal((await createLog(token, { takenAt: "2026-11-01T08:00:00Z" })).status, 201);
    assert.equal((await createLog(token, { takenAt: "2026-11-01T20:00:00Z" })).status, 201);
    const third = await createLog(token, { takenAt: "2026-11-01T23:59:00Z" });

    assert.equal(third.status, 400);
    assert.match(third.body.error, /Maximum of 2 doses/);
  });

  it("counts doses across all medications", async () => {
    await createLog(token, { medication: "A" });
    await createLog(token, { medication: "B" });
    const res = await createLog(token, { medication: "C" });

    assert.equal(res.status, 400);
  });

  it("starts a fresh count on the next day", async () => {
    await createLog(token, { takenAt: "2026-11-01T08:00:00Z" });
    await createLog(token, { takenAt: "2026-11-01T20:00:00Z" });
    const res = await createLog(token, { takenAt: "2026-11-02T00:00:00Z" });

    assert.equal(res.status, 201);
  });

  it("doesn't count other users' doses", async () => {
    await createLog(otherToken);
    await createLog(otherToken);
    const res = await createLog(token);

    assert.equal(res.status, 201);
  });

  it("rejects moving a log onto a day that is already full", async () => {
    await createLog(token, { takenAt: "2026-11-01T08:00:00Z" });
    await createLog(token, { takenAt: "2026-11-01T20:00:00Z" });
    const log = await createLog(token, { takenAt: "2026-11-02T08:00:00Z" });

    const res = await request(app)
      .patch(`/api/medlogs/${log.body._id}`)
      .set(auth(token))
      .send({ takenAt: "2026-11-01T12:00:00Z" });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Maximum of 2 doses/);
  });

  it("lets a log move within its own full day", async () => {
    await createLog(token, { takenAt: "2026-11-01T08:00:00Z" });
    const log = await createLog(token, { takenAt: "2026-11-01T20:00:00Z" });

    const res = await request(app)
      .patch(`/api/medlogs/${log.body._id}`)
      .set(auth(token))
      .send({ takenAt: "2026-11-01T21:00:00Z" });

    assert.equal(res.status, 200);
  });
});

describe("GET /api/medlogs", () => {
  it("returns only the caller's logs, newest first", async () => {
    await createLog(token, { medication: "Old", takenAt: "2026-10-01T08:00:00Z" });
    await createLog(token, { medication: "New", takenAt: "2026-10-05T08:00:00Z" });
    await createLog(otherToken, { medication: "Theirs" });

    const res = await request(app).get("/api/medlogs").set(auth(token));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((l) => l.medication), ["New", "Old"]);
  });
});

describe("GET /api/medlogs/:id", () => {
  it("returns the caller's own log", async () => {
    const log = await createLog(token);
    const res = await request(app).get(`/api/medlogs/${log.body._id}`).set(auth(token));

    assert.equal(res.status, 200);
    assert.equal(res.body._id, log.body._id);
  });

  it("returns 404 for another user's log", async () => {
    const log = await createLog(otherToken);
    const res = await request(app).get(`/api/medlogs/${log.body._id}`).set(auth(token));

    assert.equal(res.status, 404);
  });

  it("returns 404 for an id that doesn't exist", async () => {
    const id = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/medlogs/${id}`).set(auth(token));

    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed id", async () => {
    const res = await request(app).get("/api/medlogs/not-an-id").set(auth(token));
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/medlogs/:id", () => {
  it("updates only the fields sent, accepting a string dose", async () => {
    const log = await createLog(token, { notes: "original" });
    const res = await request(app)
      .patch(`/api/medlogs/${log.body._id}`)
      .set(auth(token))
      .send({ doseMg: "400" });

    assert.equal(res.status, 200);
    assert.equal(res.body.doseMg, 400);
    assert.equal(res.body.medication, "Ibuprofen");
    assert.equal(res.body.notes, "original");
  });

  it("can't reassign a log to another user", async () => {
    const log = await createLog(token);
    const otherId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/medlogs/${log.body._id}`)
      .set(auth(token))
      .send({ userId: otherId, notes: "x" });

    assert.equal(res.status, 200);
    assert.equal(res.body.userId, log.body.userId);
  });

  for (const [name, body] of [
    ["zero dose", { doseMg: 0 }],
    ["non-numeric dose", { doseMg: "abc" }],
    ["blank medication", { medication: "" }],
    ["invalid date", { takenAt: "nope" }],
  ]) {
    it(`returns 400 for ${name} and leaves the log unchanged`, async () => {
      const log = await createLog(token);
      const res = await request(app)
        .patch(`/api/medlogs/${log.body._id}`)
        .set(auth(token))
        .send(body);
      const after = await request(app).get(`/api/medlogs/${log.body._id}`).set(auth(token));

      assert.equal(res.status, 400);
      assert.deepEqual(after.body, log.body);
    });
  }

  it("returns 404 for another user's log", async () => {
    const log = await createLog(otherToken);
    const res = await request(app)
      .patch(`/api/medlogs/${log.body._id}`)
      .set(auth(token))
      .send({ notes: "hijacked" });

    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed id", async () => {
    const res = await request(app)
      .patch("/api/medlogs/not-an-id")
      .set(auth(token))
      .send({ notes: "x" });
    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/medlogs/:id", () => {
  it("deletes the caller's own log", async () => {
    const log = await createLog(token);
    const res = await request(app).delete(`/api/medlogs/${log.body._id}`).set(auth(token));
    const after = await request(app).get(`/api/medlogs/${log.body._id}`).set(auth(token));

    assert.equal(res.status, 200);
    assert.equal(after.status, 404);
  });

  it("returns 404 for another user's log and keeps it", async () => {
    const log = await createLog(otherToken);
    const res = await request(app).delete(`/api/medlogs/${log.body._id}`).set(auth(token));
    const after = await request(app)
      .get(`/api/medlogs/${log.body._id}`)
      .set(auth(otherToken));

    assert.equal(res.status, 404);
    assert.equal(after.status, 200);
  });

  it("returns 404 for a malformed id", async () => {
    const res = await request(app).delete("/api/medlogs/not-an-id").set(auth(token));
    assert.equal(res.status, 404);
  });
});
