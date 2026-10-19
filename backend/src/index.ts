import { app } from "./app";
import { env } from "./lib/env";

const port = Number(env.PORT);

// Vercel handles exported Express apps as serverless functions.
// Keep the standalone listener for local development and non-Vercel hosts.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

// This package uses CommonJS (NodeNext with type: commonjs).
// Vercel expects module.exports for CommonJS Express functions.
module.exports = app;
