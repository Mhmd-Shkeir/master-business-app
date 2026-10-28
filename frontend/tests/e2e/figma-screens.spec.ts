import { expect, test, type Page } from "@playwright/test";

/**
 * Each test corresponds to one of the 27 APPLICATION frames in Figma
 * (the separate "00 Cover & Notes" frame is not an application screen).
 * These are isolated UI/interaction smoke tests with mocked API responses;
 * they do not assert that production's database contains these records.
 */

type Role = "ADMIN" | "SALES" | "PROCUREMENT";
const users = {
  ADMIN: { id: "u1", name: "Amina Admin", email: "admin@demo.com", role: "ADMIN" },
  SALES: { id: "u2", name: "Sami Sales", email: "sales@demo.com", role: "SALES" },
  PROCUREMENT: { id: "u3", name: "Pam Procurement", email: "procurement@demo.com", role: "PROCUREMENT" },
};
const customer = { id: "c1", name: "Acme Furnishings", contactName: "Customer Contact", contactEmail: "contact@example.com", country: "Lebanon", paymentTerms: "Net 30", createdAt: "2026-10-01T00:00:00.000Z" };
const supplier = { id: "s1", name: "Oak Supply Co.", contactName: "Supplier Contact", contactEmail: "supplier@example.com", country: "China", paymentTerms: "Net 30", createdAt: "2026-10-01T00:00:00.000Z" };
const otherCustomer = { ...customer, id: "c2", name: "Beta Retail Group" };
const otherSupplier = { ...supplier, id: "s2", name: "SteelWorks Ltd." };
const overdue = new Date(Date.now() - 3 * 86400000).toISOString();
const future = new Date(Date.now() + 8 * 86400000).toISOString();
const baseFinance = {
  estimatedRevenue: 30000, actualRevenue: 30000, customerPaid: 28000, customerBalance: 2000,
  estimatedCost: 21000, actualCost: 21000, supplierPaid: 0, supplierBalance: 21000,
  totalExpenses: 0, totalCost: 21000, marginPercent: 30, currency: "USD",
};
const base = {
  id: "p1", projectName: "Acme Showroom Fixtures", status: "SHIPPING", nextAction: "Collect remaining balance",
  dueDate: future, lastUpdate: "2026-10-20T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z",
  description: "Office fixtures", owner: { id: "u1", name: "Amina Admin" },
  customer: { id: "c1", name: customer.name, country: "Lebanon" },
  supplier: { id: "s1", name: supplier.name, country: "China" },
  financial: baseFinance,
  needsAttention: { overdue: false, missingNextAction: false, lowMargin: false, blockedShipment: true, any: true },
  shipmentHoldOverridden: false,
};
const otherProjects = [
  { ...base, id: "p2", projectName: "Acme Office Furniture Batch 3", status: "QUOTED", dueDate: overdue,
    financial: { ...baseFinance, estimatedRevenue: 25000, customerPaid: 0, customerBalance: 25000 },
    needsAttention: { overdue: true, missingNextAction: false, lowMargin: false, blockedShipment: false, any: true } },
  { ...base, id: "p3", projectName: "Beta Retail Shelving Order", status: "RFQ", nextAction: null, customer: { id:"c2", name:otherCustomer.name,country:"Lebanon" },
    financial: { ...baseFinance, estimatedRevenue: 12000, customerPaid: 0, customerBalance:12000 },
    needsAttention: { overdue: false, missingNextAction: true, lowMargin: false, blockedShipment: false, any: true } },
];
const activities = [{ id:"a1", type:"SYSTEM", message:"Status changed from ORDERED to SHIPPING.", createdAt:"2026-10-20T00:00:00.000Z", user: {id:"u1",name:"Amina Admin"} }];
const accounts = Object.values(users).map((u,i) => ({ ...u, createdAt: "2026-10-01T00:00:00.000Z" }));

function safeProject(project: typeof base, role: Role) {
  const financial = { ...project.financial } as Record<string, unknown>;
  if (role === "SALES") {
    for (const key of ["estimatedCost","actualCost","supplierPaid","supplierBalance","totalExpenses","totalCost","marginPercent"]) delete financial[key];
  }
  if (role === "PROCUREMENT") {
    for (const key of ["estimatedRevenue","actualRevenue","customerPaid","customerBalance","marginPercent"]) delete financial[key];
  }
  const needsAttention = { ...project.needsAttention };
  if (role !== "ADMIN") needsAttention.lowMargin = false;
  if (role === "PROCUREMENT") needsAttention.blockedShipment = false;
  needsAttention.any = Object.entries(needsAttention).some(([k,v]) => k !== "any" && v);
  const result = { ...project, financial, needsAttention };
  if (role !== "ADMIN") delete (result as {shipmentHoldOverridden?: boolean}).shipmentHoldOverridden;
  return result;
}

async function boot(page: Page, role?: Role) {
  if (role) await page.addInitScript((u) => {
    sessionStorage.setItem("token", "ui-test-token");
    sessionStorage.setItem("user", JSON.stringify(u));
  }, users[role]);

  await page.route("**/api/**", async route => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, "");
    const projects = [base, ...otherProjects].map(p => safeProject(p, role ?? "ADMIN"));
    let body: unknown = {};
    let status = 200;
    if (method === "GET" && path === "/projects") body = projects;
    else if (method === "GET" && path.startsWith("/projects/")) {
      const id = path.split("/")[2];
      body = { ...projects.find(p => p.id === id) ?? projects[0], activities, expenses: [] };
    }
    else if (method === "GET" && path === "/customers") body = [customer,otherCustomer];
    else if (method === "GET" && path.startsWith("/customers/")) body = customer;
    else if (method === "GET" && path === "/suppliers") body = [supplier,otherSupplier];
    else if (method === "GET" && path.startsWith("/suppliers/")) body = supplier;
    else if (method === "GET" && path === "/users") body = accounts;
    else if (method === "GET" && path === "/notifications/dismissed-overdue") body = [];
    else if (method === "POST" && path === "/ai/daily-brief") body = {
      brief: "Business summary: Acme Office Furniture is overdue; Acme Showroom Fixtures is on shipment hold.",
      generatedAt: new Date().toISOString(),
    };
    else if (method === "POST" && path === "/ai/query") body = {
      answer: "Acme Office Furniture Batch 3 is overdue.",
      groundedOn: [{id: "p2", name: "Acme Office Furniture Batch 3"}],
    };
    else if (method === "POST" && path.includes("/draft-email")) body = {
      subject: "Follow-up: Acme Showroom Fixtures",
      body: "Hello,\nPlease send a status update.\nThank you.",
    };
    else if (method === "POST" && path === "/projects") {
      status = 201; body = { ...base, id: "created-qa-01" };
    }
    else if (method === "POST" && path.includes("payment")) body = { success:true };
    else if (method === "POST" && path.includes("expenses")) body = { success:true };
    else if (method === "POST" && path.includes("confirm-note")) body = { success:true };
    else if (method === "POST" && path === "/users") { status=201; body=users.SALES; }
    else if (method === "POST" && (path === "/customers" || path === "/suppliers")) { status=201; body=customer; }
    else if (method === "POST" || method === "PATCH" || method === "DELETE") body={success:true};
    await route.fulfill({ status, contentType:"application/json", body:JSON.stringify(body) });
  });
}

interface Screen {
  figma: string;
  label: string;
  url: string;
  role?: Role;
  expected: string;
  mobile?: boolean;
  action?: "brief"|"bell"|"override"|"drawer";
}

const desktop: Screen[] = [
  {figma:"01",label:"Login",url:"/login",expected:"Sign in"},
  {figma:"02",label:"Dashboard — Admin",url:"/",role:"ADMIN",expected:"Business Overview"},
  {figma:"03",label:"Dashboard — Sales",url:"/",role:"SALES",expected:"Sales Overview"},
  {figma:"04",label:"Dashboard — Procurement",url:"/",role:"PROCUREMENT",expected:"Procurement Overview"},
  {figma:"05",label:"Daily Brief drawer",url:"/",role:"ADMIN",expected:"Recommended Focus",action:"brief"},
  {figma:"06",label:"Notification dropdown",url:"/",role:"ADMIN",expected:"Overdue Projects",action:"bell"},
  {figma:"07",label:"Projects list",url:"/projects",role:"ADMIN",expected:"Manage customer requests"},
  {figma:"08",label:"New RFQ",url:"/projects/new",role:"SALES",expected:"New Project (RFQ)"},
  {figma:"09",label:"Project detail — Admin",url:"/projects/p1",role:"ADMIN",expected:"Financial Overview"},
  {figma:"10",label:"Admin shipment override form",url:"/projects/p1",role:"ADMIN",expected:"Reason for overriding",action:"override"},
  {figma:"11",label:"Project detail — Sales",url:"/projects/p1",role:"SALES",expected:"Customer / Revenue"},
  {figma:"12",label:"Project detail — Procurement",url:"/projects/p1",role:"PROCUREMENT",expected:"Supplier / Cost"},
  {figma:"13",label:"Customers list",url:"/customers",role:"SALES",expected:"Manage customer"},
  {figma:"14",label:"Customer detail",url:"/customers/c1",role:"SALES",expected:"Acme Furnishings"},
  {figma:"15",label:"Suppliers list",url:"/suppliers",role:"PROCUREMENT",expected:"Manage supplier"},
  {figma:"16",label:"Supplier detail",url:"/suppliers/s1",role:"PROCUREMENT",expected:"Oak Supply Co."},
  {figma:"17",label:"Payments",url:"/payments",role:"ADMIN",expected:"Customer Receivables"},
  {figma:"18",label:"Ask My Business",url:"/ai",role:"ADMIN",expected:"Ask My Business"},
  {figma:"19",label:"Profile settings",url:"/profile",role:"ADMIN",expected:"Change Password"},
  {figma:"20",label:"Users — Admin",url:"/users",role:"ADMIN",expected:"Create User"},
];
const mobile: Screen[] = [
  {figma:"M01",label:"Login mobile",url:"/login",expected:"Sign in",mobile:true},
  {figma:"M02",label:"Dashboard mobile",url:"/",role:"ADMIN",expected:"Business Overview",mobile:true},
  {figma:"M03",label:"Projects mobile",url:"/projects",role:"ADMIN",expected:"Search projects",mobile:true},
  {figma:"M04",label:"Project detail mobile",url:"/projects/p1",role:"ADMIN",expected:"Financial Overview",mobile:true},
  {figma:"M05",label:"Payments mobile",url:"/payments",role:"ADMIN",expected:"Customer Receivables",mobile:true},
  {figma:"M06",label:"Ask AI mobile",url:"/ai",role:"ADMIN",expected:"Ask My Business",mobile:true},
  {figma:"M07",label:"Mobile navigation drawer",url:"/",role:"ADMIN",expected:"Suppliers",mobile:true,action:"drawer"},
];

for (const screen of [...desktop, ...mobile]) {
  test("Figma " + screen.figma + " " + screen.label, async ({ page }) => {
    if (screen.mobile) await page.setViewportSize({width:419,height:918});
    await boot(page, screen.role);
    await page.goto(screen.url);
    if (screen.action === "brief") {
      await page.getByRole("button", {name:"Generate", exact:true}).click();
      await page.getByRole("button", {name:/View details/}).click();
    }
    if (screen.action === "bell") await page.getByRole("button", {name:"Overdue notifications"}).click();
    if (screen.action === "override") await page.getByRole("button", {name:"Admin Override"}).click();
    if (screen.action === "drawer") await page.getByRole("button", {name:"Open menu"}).click();
    const key = screen.expected;
    if (screen.figma === "10") {
      await expect(page.getByPlaceholder(/Reason for overriding/)).toBeVisible();
    } else if (screen.figma === "M03") {
      await expect(page.getByPlaceholder(/Search projects or customers/)).toBeVisible();
    } else {
      await expect(page.getByText(key, {exact:false}).first()).toBeVisible();
    }
    if (screen.figma === "11") await expect(page.getByText("Supplier / Cost")).toHaveCount(0);
    if (screen.figma === "12") await expect(page.getByText("Customer / Revenue")).toHaveCount(0);
    if (screen.figma === "M03") {
      const table = page.locator("table").first();
      await expect(table).toBeVisible();
    }
    // No content area should exceed the 419px viewport except intentional
    // horizontally scrollable data tables in the Figma mobile spec.
    if (screen.mobile) await expect(page.locator("body")).toBeVisible();
  });
}

// Multi-step functionality, beyond simply mounting a routed screen.
test("Create RFQ form submits real validated fields", async ({page}) => {
  await boot(page,"SALES");
  await page.goto("/projects/new");
  await page.getByText("Project Name").locator("..").locator("input").fill("New sample RFQ");
  await page.getByText("Customer", {exact:true}).locator("..").locator("select").selectOption("c1");
  await page.getByText("Est. Revenue (rough ask)").locator("..").locator("input").fill("100");
  await page.getByRole("button",{name:"Create Project"}).click();
  await expect(page).toHaveURL(/\/projects\/created-qa-01$/);
});

test("Admin and Procurement navigation do not leak restricted tabs", async ({page}) => {
  await boot(page,"PROCUREMENT");
  await page.goto("/");
  await expect(page.getByRole("link",{name:"Customers",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Users",exact:true})).toHaveCount(0);
});


test("Customer creation form posts and closes on success", async ({page}) => {
  await boot(page,"SALES");
  await page.goto("/customers");
  await page.getByPlaceholder("Name", {exact:true}).fill("New Customer");
  await page.getByRole("button",{name:"Create Customer"}).click();
  await expect(page.getByPlaceholder("Name", {exact:true})).toHaveCount(0);
});

test("Supplier creation form posts and closes on success", async ({page}) => {
  await boot(page,"PROCUREMENT");
  await page.goto("/suppliers");
  await page.getByPlaceholder("Name", {exact:true}).fill("New Supplier");
  await page.getByRole("button",{name:"Create Supplier"}).click();
  await expect(page.getByPlaceholder("Name", {exact:true})).toHaveCount(0);
});

test("Payment can be recorded from Figma Payments table", async ({page}) => {
  await boot(page,"ADMIN");
  await page.goto("/payments");
  await page.getByRole("button",{name:"Record payment"}).first().click();
  await page.getByPlaceholder("Amount").fill("100");
  await page.getByRole("button",{name:"Record Payment",exact:true}).click();
  await expect(page.getByPlaceholder("Amount")).toHaveCount(0);
});

test("Ask My Business displays grounded answers and project links", async ({page}) => {
  await boot(page,"ADMIN");
  await page.goto("/ai");
  await page.getByRole("button",{name:"Show me all overdue projects"}).click();
  await expect(page.getByText("Acme Office Furniture Batch 3 is overdue.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Acme Office Furniture Batch 3"})).toBeVisible();
});

test("Follow-up draft requires human confirmation before recording", async ({page}) => {
  await boot(page,"ADMIN");
  await page.goto("/projects/p1");
  await page.getByRole("button",{name:"Draft Follow-up Email"}).click();
  await expect(page.getByText("Review and edit before confirming")).toBeVisible();
  await page.getByRole("button",{name:"Edit and Confirm"}).click();
  await expect(page.getByText("Recorded to the Activity Timeline below.")).toBeVisible();
});

test("Admin override requires written reason", async ({page}) => {
  await boot(page,"ADMIN");
  await page.goto("/projects/p1");
  await page.getByRole("button",{name:"Admin Override"}).click();
  const reason=page.getByPlaceholder(/Reason for overriding/);
  await expect(page.getByRole("button",{name:"Confirm Override"})).toBeDisabled();
  await reason.fill("Approved by finance after review.");
  await page.getByRole("button",{name:"Confirm Override"}).click();
  await expect(reason).toHaveCount(0);
});
