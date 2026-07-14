import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !configuredSecret) {
  throw new Error("JWT_SECRET is required in production");
}
const JWT_SECRET = configuredSecret || "achieve-rfp-local-development-only-secret";
const TOKEN_TTL = "30d";
const AUTH_COOKIE = "rfp_session";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(accountId: number) {
  return jwt.sign({ accountId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): { accountId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { accountId: number };
    return decoded;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

function cookieToken(req: Request): string | null {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === AUTH_COOKIE) return decodeURIComponent(value.join("="));
  }
  return null;
}

declare global {
  namespace Express {
    interface Request {
      accountId?: number;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] || cookieToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Invalid token" });
  }
  req.accountId = decoded.accountId;
  next();
}
