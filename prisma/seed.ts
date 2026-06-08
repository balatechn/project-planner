import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

// Mirror of src/lib/password.ts (kept inline so seed has no app imports).
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  console.log("🌱 Seeding database…");
  const password = hashPassword("Password123!");

  // Clean (order matters due to FKs; cascades handle children).
  await prisma.auditLog.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.projectTemplate.deleteMany();
  await prisma.leaveEntry.deleteMany();
  await prisma.user.deleteMany();

  // ----- Users -----
  const [admin, manager, alice, bob, carol, viewer] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Avery Admin",
        email: "admin@contoso.com",
        passwordHash: password,
        role: "ADMIN",
        department: "IT",
        jobTitle: "IT Director",
        weeklyCapacity: 40,
      },
    }),
    prisma.user.create({
      data: {
        name: "Morgan Manager",
        email: "manager@contoso.com",
        passwordHash: password,
        role: "PROJECT_MANAGER",
        department: "Product",
        jobTitle: "Program Manager",
        weeklyCapacity: 40,
      },
    }),
    prisma.user.create({
      data: {
        name: "Alice Nguyen",
        email: "alice@contoso.com",
        passwordHash: password,
        role: "TEAM_MEMBER",
        department: "Engineering",
        jobTitle: "Senior Engineer",
        weeklyCapacity: 40,
      },
    }),
    prisma.user.create({
      data: {
        name: "Bob Patel",
        email: "bob@contoso.com",
        passwordHash: password,
        role: "TEAM_MEMBER",
        department: "Design",
        jobTitle: "Product Designer",
        weeklyCapacity: 32,
      },
    }),
    prisma.user.create({
      data: {
        name: "Carol Smith",
        email: "carol@contoso.com",
        passwordHash: password,
        role: "TEAM_MEMBER",
        department: "Marketing",
        jobTitle: "Marketing Specialist",
        weeklyCapacity: 40,
      },
    }),
    prisma.user.create({
      data: {
        name: "Vic Viewer",
        email: "viewer@contoso.com",
        passwordHash: password,
        role: "VIEWER",
        department: "Finance",
        jobTitle: "Financial Analyst",
        weeklyCapacity: 40,
      },
    }),
  ]);

  // ----- Template -----
  const template = await prisma.projectTemplate.create({
    data: {
      name: "Software Launch",
      description: "Standard phases for shipping a software product.",
      department: "Engineering",
      isSystem: true,
      blueprint: {
        phases: ["Discovery", "Design", "Build", "Test", "Launch"],
      },
    },
  });

  // ----- Project 1: Website Redesign -----
  const web = await prisma.project.create({
    data: {
      name: "Corporate Website Redesign",
      key: "WEB",
      description:
        "Rebuild the public marketing site with a modern design system and CMS.",
      department: "Marketing",
      priority: "HIGH",
      status: "ACTIVE",
      startDate: daysFromNow(-20),
      endDate: daysFromNow(40),
      budget: "85000",
      color: "#2563eb",
      ownerId: manager.id,
      templateId: template.id,
      members: {
        create: [
          { userId: alice.id },
          { userId: bob.id },
          { userId: carol.id },
        ],
      },
    },
  });

  // ----- Project 2: Mobile App -----
  const app = await prisma.project.create({
    data: {
      name: "Customer Mobile App",
      key: "APP",
      description: "Native iOS/Android app for customer self-service.",
      department: "Engineering",
      priority: "CRITICAL",
      status: "ACTIVE",
      startDate: daysFromNow(-10),
      endDate: daysFromNow(80),
      budget: "210000",
      color: "#10b981",
      ownerId: manager.id,
      members: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
  });

  // ----- Project 3: Brand Campaign -----
  await prisma.project.create({
    data: {
      name: "Q3 Brand Campaign",
      key: "BRAND",
      description: "Cross-channel brand awareness campaign for Q3.",
      department: "Marketing",
      priority: "MEDIUM",
      status: "PLANNING",
      startDate: daysFromNow(15),
      endDate: daysFromNow(110),
      budget: "60000",
      color: "#8b5cf6",
      ownerId: manager.id,
      members: { create: [{ userId: carol.id }] },
    },
  });

  // ----- Tasks for Website Redesign -----
  const webTasks = [
    {
      title: "Audit current site analytics",
      status: "COMPLETED" as const,
      priority: "MEDIUM" as const,
      progress: 100,
      start: -18,
      due: -12,
      assignee: carol.id,
    },
    {
      title: "Design new homepage mockups",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      progress: 60,
      start: -10,
      due: 5,
      assignee: bob.id,
    },
    {
      title: "Implement design system components",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      progress: 35,
      start: -5,
      due: 15,
      assignee: alice.id,
    },
    {
      title: "Migrate content to new CMS",
      status: "NOT_STARTED" as const,
      priority: "MEDIUM" as const,
      progress: 0,
      start: 10,
      due: 30,
      assignee: carol.id,
    },
    {
      title: "Accessibility review (WCAG 2.1 AA)",
      status: "ON_HOLD" as const,
      priority: "LOW" as const,
      progress: 0,
      start: 20,
      due: 35,
      assignee: bob.id,
    },
    {
      title: "SEO meta + redirects",
      status: "DELAYED" as const,
      priority: "HIGH" as const,
      progress: 20,
      start: -8,
      due: -2,
      assignee: carol.id,
    },
  ];

  for (const [i, t] of webTasks.entries()) {
    await prisma.task.create({
      data: {
        projectId: web.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        orderIndex: i,
        startDate: daysFromNow(t.start),
        dueDate: daysFromNow(t.due),
        estimatedHours: 16,
        completedAt: t.status === "COMPLETED" ? daysFromNow(t.due) : null,
        createdById: manager.id,
        assignees: { create: [{ userId: t.assignee }] },
        comments:
          i === 1
            ? {
                create: [
                  {
                    authorId: manager.id,
                    body: "Looks great — can we explore a darker hero variant?",
                  },
                  {
                    authorId: bob.id,
                    body: "Sure, I'll add two options by tomorrow.",
                  },
                ],
              }
            : undefined,
      },
    });
  }

  // ----- Tasks for Mobile App -----
  const appTasks = [
    {
      title: "Define MVP feature set",
      status: "COMPLETED" as const,
      progress: 100,
      start: -8,
      due: -4,
      assignee: alice.id,
    },
    {
      title: "Set up CI/CD pipeline",
      status: "IN_PROGRESS" as const,
      progress: 50,
      start: -3,
      due: 7,
      assignee: alice.id,
    },
    {
      title: "Design onboarding flow",
      status: "IN_PROGRESS" as const,
      progress: 40,
      start: -2,
      due: 10,
      assignee: bob.id,
    },
    {
      title: "Implement push notifications",
      status: "NOT_STARTED" as const,
      progress: 0,
      start: 12,
      due: 28,
      assignee: alice.id,
    },
  ];

  for (const [i, t] of appTasks.entries()) {
    await prisma.task.create({
      data: {
        projectId: app.id,
        title: t.title,
        status: t.status,
        priority: "HIGH",
        progress: t.progress,
        orderIndex: i,
        startDate: daysFromNow(t.start),
        dueDate: daysFromNow(t.due),
        estimatedHours: 24,
        completedAt: t.status === "COMPLETED" ? daysFromNow(t.due) : null,
        createdById: manager.id,
        assignees: { create: [{ userId: t.assignee }] },
      },
    });
  }

  // ----- Activity + notifications -----
  await prisma.activity.createMany({
    data: [
      {
        projectId: web.id,
        userId: manager.id,
        action: "project.created",
        entityType: "project",
        entityId: web.id,
      },
      {
        projectId: app.id,
        userId: manager.id,
        action: "project.created",
        entityType: "project",
        entityId: app.id,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: alice.id,
        type: "TASK_ASSIGNED",
        title: "New task assigned: Implement design system components",
        link: `/projects/${web.id}`,
      },
      {
        userId: bob.id,
        type: "TASK_DUE_SOON",
        title: "Task due soon: Design new homepage mockups",
        link: `/projects/${web.id}`,
      },
    ],
  });

  // ----- Leave entries -----
  await prisma.leaveEntry.createMany({
    data: [
      {
        userId: bob.id,
        type: "VACATION",
        startDate: daysFromNow(18),
        endDate: daysFromNow(25),
        approved: true,
        note: "Annual leave",
      },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("   Login with any of:");
  console.log("   admin@contoso.com / manager@contoso.com / alice@contoso.com");
  console.log("   Password: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
