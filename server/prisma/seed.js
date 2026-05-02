import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Asha Admin",
      email: "admin@example.com",
      passwordHash
    }
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: {
      name: "Milan Member",
      email: "member@example.com",
      passwordHash
    }
  });

  const project = await prisma.project.create({
    data: {
      name: "Product Launch",
      description: "Coordinate launch tasks across design, engineering, and marketing.",
      members: {
        create: [
          { userId: admin.id, role: "ADMIN" },
          { userId: member.id, role: "MEMBER" }
        ]
      },
      tasks: {
        create: [
          {
            title: "Finalize landing page copy",
            description: "Review positioning and send final copy to design.",
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
            priority: "HIGH",
            status: "IN_PROGRESS",
            assigneeId: member.id,
            createdById: admin.id
          },
          {
            title: "Create Railway deployment checklist",
            description: "Confirm environment variables, migration command, and health check.",
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
            priority: "MEDIUM",
            status: "TODO",
            assigneeId: admin.id,
            createdById: admin.id
          }
        ]
      }
    }
  });

  console.log(`Seeded ${project.name}`);
  console.log("Admin login: admin@example.com / Password123!");
  console.log("Member login: member@example.com / Password123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
