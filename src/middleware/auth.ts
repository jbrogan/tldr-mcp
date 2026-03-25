/**
 * Auth Middleware
 *
 * Extracts and validates Supabase JWT from Authorization header.
 * Attaches StoreContext to the request for downstream use.
 */

import type { Request, Response, NextFunction } from "express";
import { createContextFromToken, type StoreContext } from "../store/base.js";

// Extend Express Request to carry store context
declare global {
  namespace Express {
    interface Request {
      storeContext?: StoreContext;
    }
  }
}

/**
 * Express middleware that validates the Supabase JWT from the Authorization header
 * and attaches the resulting StoreContext to req.storeContext.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.storeContext = await createContextFromToken(token);
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    res.status(401).json({ error: message });
  }
}
