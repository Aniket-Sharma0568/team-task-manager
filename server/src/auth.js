import jwt from "jsonwebtoken";
import { prisma } from "./db.js";
import { ApiError } from "./errors.js";

const secret = process.env.JWT_SECRET || "development-secret-change-me";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "7d" });
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new ApiError(401, "Authentication required");
    }

    const payload = jwt.verify(token, secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, createdAt: true }
    });

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err.status ? err : new ApiError(401, "Invalid or expired token"));
  }
}

export async function getMembership(projectId, userId) {
  return prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
}

export async function requireProjectMember(req, _res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const membership = await getMembership(projectId, req.user.id);

    if (!membership) {
      throw new ApiError(403, "You are not a member of this project");
    }

    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireProjectAdmin(req, _res, next) {
  if (req.membership?.role !== "ADMIN") {
    return next(new ApiError(403, "Admin access required"));
  }

  next();
}
