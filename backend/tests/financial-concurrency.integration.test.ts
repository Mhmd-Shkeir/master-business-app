import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { recordPayment, transitionProjectStatus } from "../src/modules/projects/projects.service";

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === "1";

// Only run with a dedicated disposable test database. Never set this flag
// when DATABASE_URL points to a real business database.
describe.skipIf(!enabled)("concurrent updates against PostgreSQL", () => {
  let projectId: string;
  let customerId: string;
  let supplierId: string;
  let userId: string;
  let user: { id: string; role: "SALES" };

  beforeAll(async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const account = await prisma.user.create({
      data: {
        name: "SEQA Concurrency Tester",
        email: `seqa-concurrent-${unique}@example.invalid`,
        passwordHash: "not-a-real-password",
        role: "SALES",
      },
    });
    userId = account.id;
    user = { id: userId, role: "SALES" };
    const customer = await prisma.customer.create({ data: { name: `SEQA Customer ${unique}` } });
    customerId = customer.id;
    const supplier = await prisma.supplier.create({ data: { name: `SEQA Supplier ${unique}` } });
    supplierId = supplier.id;
    const project = await prisma.project.create({
      data: {
        projectName: `SEQA Transactions ${unique}`,
        status: "SHIPPING",
        customerId,
        supplierId,
        ownerId: userId,
        financial: {
          create: {
            estimatedRevenue: 100,
            actualRevenue: 100,
            estimatedCost: 70,
            actualCost: 70,
          },
        },
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.activity.deleteMany({ where: { projectId } });
      await prisma.notificationDismissal.deleteMany({ where: { projectId } });
      await prisma.expense.deleteMany({ where: { projectId } });
      await prisma.financial.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });
    }
    if (customerId) await prisma.customer.delete({ where: { id: customerId } });
    if (supplierId) await prisma.supplier.delete({ where: { id: supplierId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("uses the database foreign key to protect assigned suppliers", async () => {
    await expect(prisma.supplier.delete({ where: { id: supplierId } }))
      .rejects.toMatchObject({ code: "P2003" });
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.supplierId).toBe(supplierId);
  });

  it("does not allow two concurrent payments to overpay the same balance", async () => {
    const results = await Promise.allSettled([
      recordPayment(projectId, "customer", 60, "First attempt", user),
      recordPayment(projectId, "customer", 60, "Concurrent attempt", user),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const financial = await prisma.financial.findUniqueOrThrow({ where: { projectId } });
    expect(Number(financial.customerPaid)).toBe(60);
    const payments = await prisma.activity.count({
      where: { projectId, message: { startsWith: "Customer payment of 60.00" } },
    });
    expect(payments).toBe(1);
  });

  it("cannot close with an unpaid customer balance during a concurrent payment", async () => {
    await prisma.financial.update({ where: { projectId }, data: { customerPaid: 50 } });
    await prisma.project.update({ where: { id: projectId }, data: { status: "SHIPPING" } });

    const results = await Promise.allSettled([
      recordPayment(projectId, "customer", 50, "Settle outstanding balance", user),
      transitionProjectStatus(projectId, "CLOSED", user),
    ]);
    expect(results[0].status).toBe("fulfilled");

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { financial: true },
    });
    if (project.status === "CLOSED") {
      expect(Number(project.financial!.customerPaid)).toBe(100);
    }
    expect(Number(project.financial!.customerPaid)).toBe(100);
  });

  it("allows only one successful concurrent transition from the same stage", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { status: "RFQ" } });
    const attempts = await Promise.allSettled([
      transitionProjectStatus(projectId, "QUOTED", user),
      transitionProjectStatus(projectId, "QUOTED", user),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("QUOTED");
    const transitions = await prisma.activity.count({
      where: { projectId, message: "Status changed from RFQ to QUOTED." },
    });
    expect(transitions).toBe(1);
  });
});
