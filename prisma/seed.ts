import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PLANS } from "@/lib/billing/plans";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

async function upsertUser(opts: {
  email: string;
  name: string;
  isSuperAdmin?: boolean;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      name: opts.name,
      passwordHash,
      isSuperAdmin: opts.isSuperAdmin ?? false,
    },
    update: { name: opts.name, isSuperAdmin: opts.isSuperAdmin ?? false },
  });
}

async function main() {
  const [superAdmin, owner, admin, accountant, sales, staff] = await Promise.all([
    upsertUser({
      email: "superadmin@dotnapps.test",
      name: "Sam Platform",
      isSuperAdmin: true,
    }),
    upsertUser({ email: "owner@dotnapps.test", name: "Olivia Owner" }),
    upsertUser({ email: "admin@dotnapps.test", name: "Adam Admin" }),
    upsertUser({ email: "accountant@dotnapps.test", name: "Anaya Accountant" }),
    upsertUser({ email: "sales@dotnapps.test", name: "Sadie Sales" }),
    upsertUser({ email: "staff@dotnapps.test", name: "Sam Staff" }),
  ]);

  const business = await prisma.business.upsert({
    where: { slug: "acme-design-studio" },
    create: {
      name: "Acme Design Studio",
      slug: "acme-design-studio",
      createdById: owner.id,
      contactEmail: "hello@acmedesign.test",
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
      gstin: "29ABCDE1234F1Z5",
      registrationType: "REGULAR",
      currency: "INR",
    },
    update: {},
  });

  const memberships: Array<{ userId: string; role: Role }> = [
    { userId: owner.id, role: "OWNER" },
    { userId: admin.id, role: "ADMIN" },
    { userId: accountant.id, role: "ACCOUNTANT" },
    { userId: sales.id, role: "SALES" },
    { userId: staff.id, role: "STAFF" },
  ];

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: { userId_businessId: { userId: m.userId, businessId: business.id } },
      create: { userId: m.userId, businessId: business.id, role: m.role },
      update: { role: m.role, status: "ACTIVE" },
    });
  }

  for (const plan of DEFAULT_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
  }
  const growthPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: "growth" } });

  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      planId: growthPlan.id,
      status: "ACTIVE",
      currentPeriodEnd,
    },
    update: {
      planId: growthPlan.id,
      status: "ACTIVE",
      currentPeriodEnd,
      graceEndsAt: null,
      suspendedAt: null,
      cancelledAt: null,
    },
  });

  console.log("Seeded:");
  console.log(`  Business: ${business.name} (${business.slug})`);
  console.log(`  Subscription: ${growthPlan.name} (ACTIVE)`);
  console.log(`  Super admin: superadmin@dotnapps.test / ${DEMO_PASSWORD}`);
  console.log(
    `  Members: owner@ / admin@ / accountant@ / sales@ / staff@dotnapps.test / ${DEMO_PASSWORD}`,
  );
  void superAdmin;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
