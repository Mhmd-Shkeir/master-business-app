import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";

export interface AuthUser {
  id: string;
  role: "ADMIN" | "SALES" | "PROCUREMENT";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Revalidate the account on every request. The JWT identifies a session,
 * but current permissions always come from the database, never a stale claim.
 * Incrementing sessionVersion on password changes revokes all older tokens.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (
    typeof payload === "string" ||
    typeof payload.id !== "string" ||
    !Number.isInteger(payload.sessionVersion) ||
    payload.sessionVersion < 0
  ) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const account = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (!account || account.sessionVersion !== payload.sessionVersion) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: account.id, role: account.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function signToken(user: { id: string; sessionVersion: number }): string {
  return jwt.sign(user, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}
