import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Explicit, one-time DEMO business data — never touch credentials or existing records.
// Run only against a database explicitly approved for demonstrations.
const prisma = new PrismaClient();
function daysFromNow(days: number): Date {
  const d = new Date(); d.setDate(d.getDate() + days); return d;
}
async function main() {
  if (process.env.DEMO_BUSINESS_SEED !== "allow-one-time-business-demo") {
    throw new Error("Demo business seeding is not explicitly enabled");
  }
  // Fail closed on any pre-existing business data. Never mix synthetic sample
  // projects with real customer or supplier records.
  const [customers, suppliers, projects] = await Promise.all([
    prisma.customer.count(), prisma.supplier.count(), prisma.project.count()
  ]);
  if (customers || suppliers || projects) {
    console.log("Business data already exists; no demo records were inserted.");
    return;
  }
  const accounts = await Promise.all(["admin@demo.com","sales@demo.com","procurement@demo.com"]
    .map(email => prisma.user.findUnique({ where: { email }, select: { id:true, email:true } })));
  if (accounts.some(x=>!x)) throw new Error("Create the three demo user accounts first");
  const [admin, sales, procurement] = accounts as {id:string;email:string}[];
  const [acme, beta, globex] = await Promise.all([
    prisma.customer.create({
      data: { name: "Acme Furnishings", contactName: "John Doe", contactEmail: "john@acme.com", country: "UAE", paymentTerms: "Net 30" },
    }),
    prisma.customer.create({
      data: { name: "Beta Retail Group", contactName: "Layla Nasser", contactEmail: "layla@betaretail.com", country: "Lebanon", paymentTerms: "Net 15" },
    }),
    prisma.customer.create({
      data: { name: "Globex Trading", contactName: "Omar Haddad", contactEmail: "omar@globex.com", country: "KSA", paymentTerms: "Net 45" },
    }),
  ]);

  const [oakSupply, steelWorks] = await Promise.all([
    prisma.supplier.create({
      data: { name: "Oak Supply Co.", contactName: "Wei Chen", country: "China", paymentTerms: "Net 30" },
    }),
    prisma.supplier.create({
      data: { name: "SteelWorks Ltd.", contactName: "Marco Rossi", country: "Italy", paymentTerms: "Net 60" },
    }),
  ]);

  // 1. Overdue, missing follow-up
  await prisma.project.create({
    data: {
      projectName: "Acme Office Furniture Batch 3",
      status: "QUOTED",
      customerId: acme.id,
      supplierId: oakSupply.id,
      ownerId: sales.id,
      nextAction: "Follow up on quote approval",
      dueDate: daysFromNow(-2),
      financial: {
        create: { estimatedRevenue: 25000, estimatedCost: 18000, actualRevenue: 0, actualCost: 0 },
      },
      activities: {
        create: [{ type: "SYSTEM", message: "Project created from RFQ.", userId: sales.id }],
      },
    },
  });

  // 2. Missing next action
  await prisma.project.create({
    data: {
      projectName: "Beta Retail Shelving Order",
      status: "RFQ",
      customerId: beta.id,
      ownerId: sales.id,
      nextAction: null,
      dueDate: daysFromNow(5),
      financial: { create: { estimatedRevenue: 12000, estimatedCost: 9000 } },
      activities: { create: [{ type: "SYSTEM", message: "RFQ received from customer.", userId: sales.id }] },
    },
  });

  // 3. Low margin (< 20%)
  await prisma.project.create({
    data: {
      projectName: "Globex Warehouse Racking",
      status: "ORDERED",
      customerId: globex.id,
      supplierId: steelWorks.id,
      ownerId: procurement.id,
      nextAction: "Confirm supplier delivery date",
      dueDate: daysFromNow(10),
      financial: {
        create: { estimatedRevenue: 40000, estimatedCost: 34000, actualRevenue: 40000, actualCost: 34500 },
      },
      activities: {
        create: [
          { type: "SYSTEM", message: "Order confirmed with supplier.", userId: procurement.id },
          { type: "UPDATE", message: "Supplier increased cost by 3% due to steel prices.", userId: procurement.id },
        ],
      },
    },
  });

  // 4. Shipping + outstanding balance -> should block Closed
  await prisma.project.create({
    data: {
      projectName: "Acme Showroom Fixtures",
      status: "SHIPPING",
      customerId: acme.id,
      supplierId: oakSupply.id,
      ownerId: admin.id,
      nextAction: "Collect remaining customer balance",
      dueDate: daysFromNow(3),
      financial: {
        create: { estimatedRevenue: 30000, actualRevenue: 30000, estimatedCost: 21000, actualCost: 21000, customerPaid: 28000 },
      },
      activities: {
        create: [
          { type: "SYSTEM", message: "Shipment created.", userId: admin.id },
          { type: "UPDATE", message: "Customer balance of $2,000 still outstanding.", userId: admin.id },
        ],
      },
    },
  });

  // 5. Shipping + fully paid -> closeable
  await prisma.project.create({
    data: {
      projectName: "Beta Retail Checkout Counters",
      status: "SHIPPING",
      customerId: beta.id,
      supplierId: steelWorks.id,
      ownerId: sales.id,
      nextAction: "Confirm delivery and close project",
      dueDate: daysFromNow(1),
      financial: {
        create: { estimatedRevenue: 18000, actualRevenue: 18000, estimatedCost: 13000, actualCost: 13200, customerPaid: 18000 },
      },
      activities: {
        create: [{ type: "SYSTEM", message: "Shipment created.", userId: sales.id }],
      },
    },
  });

  // 6. Already closed, healthy margin
  await prisma.project.create({
    data: {
      projectName: "Globex Head Office Furniture",
      status: "CLOSED",
      customerId: globex.id,
      supplierId: oakSupply.id,
      ownerId: admin.id,
      nextAction: null,
      dueDate: daysFromNow(-20),
      financial: {
        create: { estimatedRevenue: 22000, actualRevenue: 22000, estimatedCost: 15000, actualCost: 14800, customerPaid: 22000 },
      },
      activities: {
        create: [
          { type: "SYSTEM", message: "Project closed.", userId: admin.id },
        ],
      },
    },
  });


  console.log("Six demo projects, three demo customers and two demo suppliers created.");
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Demo setup failed");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
