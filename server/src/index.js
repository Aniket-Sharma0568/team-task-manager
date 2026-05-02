import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { requireAuth, requireProjectAdmin, requireProjectMember, signToken } from "./auth.js";
import { ApiError, badRequest, forbidden, handleErrors, notFound } from "./errors.js";
import {
  addMemberSchema,
  loginSchema,
  projectSchema,
  signupSchema,
  statusSchema,
  taskSchema,
  updateTaskSchema
} from "./validators.js";

const app = express();
const port = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

const publicUser = { id: true, name: true, email: true };
const taskInclude = {
  assignee: { select: publicUser },
  createdBy: { select: publicUser }
};

function toDate(value) {
  return value ? new Date(value) : null;
}

async function assertAssigneeInProject(projectId, assigneeId) {
  if (!assigneeId) return;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: assigneeId, projectId } }
  });

  if (!membership) {
    throw badRequest("Assignee must be a member of this project");
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash },
      select: publicUser
    });

    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token: signToken(user)
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/projects", requireAuth, async (req, res, next) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user.id },
      include: {
        project: {
          include: {
            _count: { select: { tasks: true, members: true } }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });

    res.json({
      projects: memberships.map((membership) => ({
        ...membership.project,
        role: membership.role
      }))
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/projects", requireAuth, async (req, res, next) => {
  try {
    const data = projectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description || null,
        members: {
          create: {
            userId: req.user.id,
            role: "ADMIN"
          }
        }
      },
      include: {
        members: { include: { user: { select: publicUser } } },
        _count: { select: { tasks: true, members: true } }
      }
    });

    res.status(201).json({ project: { ...project, role: "ADMIN" } });
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/:projectId", requireAuth, requireProjectMember, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        members: {
          include: { user: { select: publicUser } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
        },
        _count: { select: { tasks: true } }
      }
    });

    if (!project) throw notFound("Project not found");
    res.json({ project: { ...project, role: req.membership.role } });
  } catch (err) {
    next(err);
  }
});

app.post(
  "/api/projects/:projectId/members",
  requireAuth,
  requireProjectMember,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const data = addMemberSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { email: data.email } });

      if (!user) {
        throw notFound("No user exists with that email. Ask them to sign up first.");
      }

      const member = await prisma.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: req.params.projectId } },
        update: { role: data.role },
        create: { userId: user.id, projectId: req.params.projectId, role: data.role },
        include: { user: { select: publicUser } }
      });

      res.status(201).json({ member });
    } catch (err) {
      next(err);
    }
  }
);

app.delete(
  "/api/projects/:projectId/members/:userId",
  requireAuth,
  requireProjectMember,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      if (req.params.userId === req.user.id) {
        throw badRequest("Admins cannot remove themselves");
      }

      await prisma.projectMember.delete({
        where: {
          userId_projectId: { userId: req.params.userId, projectId: req.params.projectId }
        }
      });

      await prisma.task.updateMany({
        where: { projectId: req.params.projectId, assigneeId: req.params.userId },
        data: { assigneeId: null }
      });

      res.status(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return next(notFound("Member not found"));
      }
      next(err);
    }
  }
);

app.get("/api/projects/:projectId/tasks", requireAuth, requireProjectMember, async (req, res, next) => {
  try {
    const where =
      req.membership.role === "ADMIN"
        ? { projectId: req.params.projectId }
        : { projectId: req.params.projectId, assigneeId: req.user.id };

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
    });

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

app.post(
  "/api/projects/:projectId/tasks",
  requireAuth,
  requireProjectMember,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const data = taskSchema.parse(req.body);
      await assertAssigneeInProject(req.params.projectId, data.assigneeId);

      const task = await prisma.task.create({
        data: {
          title: data.title,
          description: data.description || null,
          dueDate: toDate(data.dueDate),
          priority: data.priority,
          assigneeId: data.assigneeId || null,
          projectId: req.params.projectId,
          createdById: req.user.id
        },
        include: taskInclude
      });

      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  }
);

app.patch("/api/tasks/:taskId", requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: { project: true }
    });

    if (!current) throw notFound("Task not found");

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: current.projectId } }
    });

    if (!membership) throw forbidden();

    const data = updateTaskSchema.parse(req.body);
    const isAdmin = membership.role === "ADMIN";
    const isAssignee = current.assigneeId === req.user.id;

    if (!isAdmin) {
      const keys = Object.keys(data);
      if (!isAssignee || keys.some((key) => key !== "status")) {
        throw forbidden("Members can update only the status of tasks assigned to them");
      }
    }

    if (data.assigneeId !== undefined) {
      await assertAssigneeInProject(current.projectId, data.assigneeId);
    }

    const task = await prisma.task.update({
      where: { id: current.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.dueDate !== undefined ? { dueDate: toDate(data.dueDate) } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId || null } : {})
      },
      include: taskInclude
    });

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/tasks/:taskId/status", requireAuth, async (req, res, next) => {
  try {
    const data = statusSchema.parse(req.body);
    const current = await prisma.task.findUnique({ where: { id: req.params.taskId } });

    if (!current) throw notFound("Task not found");

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: current.projectId } }
    });

    if (!membership) throw forbidden();

    const isAdmin = membership.role === "ADMIN";
    const isAssignee = current.assigneeId === req.user.id;

    if (!isAdmin && !isAssignee) {
      throw forbidden("Members can update only tasks assigned to them");
    }

    const task = await prisma.task.update({
      where: { id: current.id },
      data: { status: data.status },
      include: taskInclude
    });

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/tasks/:taskId", requireAuth, async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!task) throw notFound("Task not found");

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: task.projectId } }
    });

    if (membership?.role !== "ADMIN") throw forbidden("Admin access required");

    await prisma.task.delete({ where: { id: task.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/:projectId/dashboard", requireAuth, requireProjectMember, async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const taskScope =
      req.membership.role === "ADMIN" ? { projectId } : { projectId, assigneeId: req.user.id };
    const now = new Date();

    const [totalTasks, byStatus, byUser, overdueTasks] = await Promise.all([
      prisma.task.count({ where: taskScope }),
      prisma.task.groupBy({ by: ["status"], where: taskScope, _count: { _all: true } }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: taskScope,
        _count: { _all: true }
      }),
      prisma.task.findMany({
        where: { ...taskScope, dueDate: { lt: now }, status: { not: "DONE" } },
        include: taskInclude,
        orderBy: { dueDate: "asc" }
      })
    ]);

    const users = await prisma.user.findMany({
      where: { id: { in: byUser.map((item) => item.assigneeId).filter(Boolean) } },
      select: publicUser
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    res.json({
      dashboard: {
        totalTasks,
        byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count._all])),
        byUser: byUser.map((item) => ({
          assignee: item.assigneeId ? userById.get(item.assigneeId) : null,
          count: item._count._all
        })),
        overdueTasks
      }
    });
  } catch (err) {
    next(err);
  }
});

app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use(handleErrors);

app.listen(port, () => {
  console.log(`Team Task Manager API running on port ${port}`);
});
