import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1, "DIRECT_DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  AI_BASE_URL: z.string().optional(),
  AI_MODEL_ID: z.string().optional(),
  AI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check backend/.env against .env.example");
}

export const env = parsed.data;

export const aiConfigured = Boolean(env.AI_BASE_URL && env.AI_MODEL_ID && env.AI_API_KEY);
