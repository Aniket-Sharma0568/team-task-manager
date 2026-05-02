import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable()
});

export const addMemberSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER")
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  assigneeId: z.string().optional().nullable()
});

export const updateTaskSchema = taskSchema.partial().extend({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional()
});

export const statusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"])
});
