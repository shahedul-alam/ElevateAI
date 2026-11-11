import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { HttpError } from "../../middleware/errors";
import { auth, type Session } from "./auth.config";

declare global {
  namespace Express {
    interface Request {
      auth?: Session;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new HttpError(401, "Unauthorized");
  if (session.user.suspendedAt) throw new HttpError(403, "Account suspended");
  req.auth = session;
  next();
};

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new HttpError(401, "Unauthorized");
    if (!roles.includes(req.auth.user.role))
      throw new HttpError(403, "Forbidden");
    next();
  };
