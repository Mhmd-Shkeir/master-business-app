import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Optional for local configurations; Vercel Prisma Postgres provides DATABASE_URL.
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:5173,http://localhost:4173"),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL_ID: z.string().optional(),
  AI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check backend/.env against .env.example");
}

if (parsed.data.NODE_ENV === "production" && !process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS must be explicitly configured in production");
}

export const env = parsed.data;

export const aiConfigured = Boolean(env.AI_BASE_URL && env.AI_MODEL_ID && env.AI_API_KEY);
