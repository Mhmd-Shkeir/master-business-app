import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

// One-time Vercel deployment provisioning; NOT the insecure sample-data seeder.
// Passwords are provided only through Vercel's sensitive environment variables.
// This script must not print the password or customer data.
async function main() {
  const password = process.env.DEMO_SEED_PASSWORD;
  const gate = process.env.DEMO_SEED_ONCE;
  if (gate !== "provision-strong-demo-accounts" || !password || password.length < 20) {
    throw new Error("One-time demo provisioning requires the explicit gate and a strong secret.");
  }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const accounts: { email: string; name: string; role: Role }[] = [
      { email: "admin@demo.com", name: "Amina Admin", role: "ADMIN" },
      { email: "sales@demo.com", name: "Sami Sales", role: "SALES" },
      { email: "procurement@demo.com", name: "Pam Procurement", role: "PROCUREMENT" },
    ];
    for (const account of accounts) {
      await prisma.user.upsert({
        where: { email: account.email },
        create: { ...account, passwordHash },
        // Rotate existing demo credentials, invalidate older JWTs, ensure intended roles.
        update: { name: account.name, role: account.role, passwordHash, sessionVersion: { increment: 1 } },
      });
    }
    console.log("One-time demo sign-in provisioning completed for three roles.");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((err) => {
  console.error("Demo account provisioning failed:", err instanceof Error ? err.name : "unknown");
  process.exit(1);
});
