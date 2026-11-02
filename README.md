# MedLog-API

A REST API for logging doses of medications, supplements, or anything else taken on a schedule. It's built with Express 5 and MongoDB (Mongoose), and uses JWT authentication.

## Background and direction

Right now the API is built around one person's routine: one medication, one schedule, and hard-coded rules like the limit of 2 doses per day. Users interact with it through **Apple Shortcuts**, and the shortcut currently does much of the logic itself, such as checking which medication is current and when the next dose is due.

The plan is to generalize it in two ways:

- **Log anything.** Users can log any medication, supplement, or similar item, each with its own dosing rules and schedule, instead of rules hard-coded for one routine.
- **Let the API make every decision.** All checks move into the API: which item is due, when the next dose is, whether a dose is allowed. That keeps the shortcut simple. It only collects input from the user and manages alarms and calendar events, based on what the API tells it.

## Getting started

Requirements: Node.js 22+ and a MongoDB database (local or Atlas).

```bash
npm install
npm run dev     # auto-reloads on changes (nodemon)
npm start       # production
npm test        # run the test suite
```

Tests run against an in-memory MongoDB, so they don't need a database or a `.env` file. The first run downloads a MongoDB binary.

Create a `.env` file in the project root:

| Variable         | Required | Default | Purpose                              |
| ---------------- | -------- | ------- | ------------------------------------ |
| `MONGO_URI`      | yes      | none    | MongoDB connection string            |
| `JWT_SECRET`     | yes      | none    | Secret for signing JWTs              |
| `JWT_EXPIRES_IN` | no       | `7d`    | How long a token stays valid         |
| `PORT`           | no       | `3000`  | Port the server listens on           |

The server won't start if `MONGO_URI` or `JWT_SECRET` is missing.

### Docker

```bash
docker build -t medlog-api .
docker run -p 3000:3000 --env-file .env medlog-api
```

Every push to `main` runs the tests and, if they pass, builds the image and pushes it to Docker Hub as `medlog-api:latest` and `medlog-api:<commit-sha>`, via GitHub Actions.

## API

Every endpoint takes and returns JSON. The med-log endpoints require an `Authorization: Bearer <token>` header with the token returned by register or login. Errors come back as `{ "error": "..." }`.

### Auth

| Method | Path                 | Body                  | Returns                          |
| ------ | -------------------- | --------------------- | -------------------------------- |
| POST   | `/api/auth/register` | `{ email, password }` | `201 { user: { id, email }, token }` |
| POST   | `/api/auth/login`    | `{ email, password }` | `200 { user: { id, email }, token }` |

Passwords must be at least 8 characters, with at least one uppercase letter, one number, and one special character.

### Med logs

| Method | Path                | Description                                   |
| ------ | ------------------- | --------------------------------------------- |
| GET    | `/api/medlogs`      | List your logs, newest first                  |
| POST   | `/api/medlogs`      | Create a log                                  |
| GET    | `/api/medlogs/:id`  | Get one log                                   |
| PATCH  | `/api/medlogs/:id`  | Update any of the fields below                |
| DELETE | `/api/medlogs/:id`  | Delete a log                                  |

A log has these fields:

| Field        | Type   | Notes                               |
| ------------ | ------ | ----------------------------------- |
| `medication` | string | required                            |
| `doseMg`     | number | required, must be greater than 0    |
| `takenAt`    | date   | required, ISO 8601 string           |
| `notes`      | string | optional                            |

Users can only see and change their own logs. Asking for someone else's log returns `404`.

**Current rule:** at most **2 doses per calendar day**, counted across all medications and based on the server's time zone. Exceeding it returns `400`. This is one of the rules that will be generalized.

## Project structure

```
src/
  server.js        connects to MongoDB, then starts the server
  app.js           Express app, routes, error handler
  routes/          URL paths → controllers
  controllers/     HTTP layer: maps service errors to status codes
  services/        validation and business rules
  models/          Mongoose schemas (User, MedLog)
  middleware/      JWT authentication
```

## TODO

### Generalization

- [ ] Let users define their own medications/supplements, each with its own dose, unit (not just mg), and schedule.
- [ ] Replace the hard-coded 2-doses-per-day limit with per-item rules.
- [ ] Use the user's time zone for day boundaries instead of the server's.
- [ ] Move the shortcut's checks into the API: what's currently due, when the next dose is, and whether a dose is allowed right now.
- [ ] Return everything the shortcut needs (e.g. next dose time) so it only has to set alarms and calendar events.

### Users and passwords

- [x] Store users in a `users` collection.
- [x] Normalize emails before storing and comparing them.
- [x] Create a unique index on `email`.
- [x] Hash passwords using bcrypt (consider Argon2id).
- [x] Never store plaintext passwords.
- [x] Enforce password strength requirements.
- [x] Return the same error message for an invalid email or password.
- [ ] Add rate limiting for failed login attempts.

### Login endpoint

- [x] Create `POST /auth/login`.
- [x] Verify the password hash.
- [x] Generate a JWT access token.
- [ ] Generate a cryptographically secure random refresh token.
- [ ] Store only the hash of the refresh token.
- [ ] Return `accessToken`, `refreshToken`, and `expiresIn`.

### Access tokens

- [ ] Set expiration to 10–15 minutes.
- [ ] Include `sub`, `iss`, `aud`, `iat`, and `exp` claims.
- [ ] Verify signature, issuer, audience, algorithm, and expiration on every request.
- [ ] Never store access tokens in MongoDB.
- [ ] Never include sensitive user data inside the JWT.

### Authentication middleware and protected routes

- [x] Read the `Authorization: Bearer <token>` header and verify the JWT.
- [x] Reject invalid or expired tokens with `401 Unauthorized`.
- [x] Take the user's ID from the `sub` claim, never from the request body.
- [x] Only return, update, or delete logs belonging to the authenticated user.

### Refresh token sessions

- [ ] Create a `sessions` collection storing user ID, refresh token hash, session ID, token family ID, created date, expiration date, and revocation status.
- [ ] Set refresh token expiration (e.g. 30 days).
- [ ] Add a TTL index to remove expired sessions automatically.
- [ ] Create `POST /auth/refresh`: verify the refresh token (exists, not expired, not revoked), issue new access and refresh tokens, and revoke the old one.
- [ ] Rotate refresh tokens on every refresh.
- [ ] Detect reuse of a rotated refresh token and revoke the whole session if it happens.

### Logout

- [ ] Create `POST /auth/logout` to revoke the current refresh token.
- [ ] Create `POST /auth/logout-all` to revoke all of a user's refresh tokens.
- [ ] Revoke all sessions after a password change.

### Shortcut (client) behavior

- [ ] Store the access and refresh tokens securely.
- [ ] Send the access token on every protected request.
- [ ] Only send the refresh token to `/auth/refresh` or `/auth/logout`.
- [ ] Refresh the access token automatically after a `401`, and replace the stored refresh token each time.
- [ ] Send the user back to login if the refresh fails.

### Security

- [ ] Require HTTPS everywhere.
- [x] Keep secrets out of source code (environment variables).
- [ ] Validate all request bodies (partially done).
- [ ] Limit request body size.
- [ ] Configure CORS.
- [ ] Avoid logging passwords or tokens.
- [x] Write authentication and authorization tests.
- [ ] Rotate signing secrets when necessary.
