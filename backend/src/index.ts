import express from "express";

// Keep bootstrapping separate from application imports so startup
// configuration failures return a controlled response instead of crashing
// the serverless invocation. Never expose environment values or stack traces.
const entry = express();
entry.use(async (req, res, next) => {
  try {
    const { app } = await import("./app.js");
    app(req, res, next);
  } catch (err) {
    console.error("Backend startup failed:", err);
    const description = err instanceof Error ? err.message : "";
    const category = description.includes("Invalid environment variables")
      ? "ENV_CONFIGURATION"
      : /prisma/i.test(description)
        ? "DATABASE_CLIENT"
        : /Cannot find module|ERR_MODULE_NOT_FOUND|Cannot resolve/.test(description)
          ? "MODULE_RESOLUTION"
          : "APPLICATION_STARTUP";
    res.status(503).json({ status: "unavailable", error: "Backend startup failed", category });
  }
});

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 4000);
  entry.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
}

// backend/package.json uses CommonJS.
module.exports = entry;
