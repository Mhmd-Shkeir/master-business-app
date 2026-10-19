"use strict";
const express = require("express");

// Explicit top-level CommonJS Express entry for Vercel's auto-detection.
// The application is built to dist/ by the backend build command.
const handler = express();
handler.use((req, res, next) => {
  try {
    const { app } = require("./dist/app.js");
    return app(req, res, next);
  } catch (err) {
    console.error("Backend initialization failed:", err);
    const message = err && typeof err.message === "string" ? err.message : "";
    const category = /Invalid environment variables/.test(message)
      ? "ENV_CONFIGURATION"
      : /prisma/i.test(message)
        ? "DATABASE_CLIENT"
        : /Cannot find module|MODULE_NOT_FOUND|Cannot resolve/.test(message)
          ? "MODULE_RESOLUTION"
          : "APPLICATION_STARTUP";
    return res.status(503).json({ status: "unavailable", category });
  }
});

module.exports = handler;
