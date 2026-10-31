require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Without a signing secret, registration would create the user and then fail
  // to issue a token, so refuse to start instead.
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
    process.exit(1);
  }

  // Connect to MongoDB before accepting requests so no request hits a dead DB.
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
