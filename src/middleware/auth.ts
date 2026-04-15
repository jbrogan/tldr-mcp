/**
 * Auth Middleware
 *
 * Accepts either a Supabase JWT or a tldr API token (tldr_live_*).
 * Attaches StoreContext to the request for downstream use.
 */

import type { Request, Response, NextFunction } from "express";
import {
  createContextFromToken,
  createContextFromUserId,
  type StoreContext,
} from "../store/base.js";
import { findUserIdByToken, isApiToken } from "../store/apiTokens.js";

// Extend Express Request to carry store context
declare global {
  namespace Express {
    interface Request {
      storeContext?: StoreContext;
    }
  }
}

function sendUnauthorized(res: Response, message: string): void {
  const publicUrl = process.env.PUBLIC_URL ?? "https://tldr-mcp-production.up.railway.app";
  res.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
  );
  res.status(401).json({ error: message });
}

/**
 * Express middleware that validates the bearer token from the Authorization header.
 * Accepts either a Supabase JWT or an API token (tldr_live_*).
 *
 * On 401, sets WWW-Authenticate per RFC 9728 so MCP clients can discover the
 * OAuth authorization server via /.well-known/oauth-protected-resource.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendUnauthorized(res, "Missing or invalid Authorization header");
    return;
  }

  const token = authHeader.slice(7);

  try {
    if (isApiToken(token)) {
      const userId = await findUserIdByToken(token);
      if (!userId) {
        sendUnauthorized(res, "Invalid or expired API token");
        return;
      }
      req.storeContext = await createContextFromUserId(userId);
    } else {
      req.storeContext = await createContextFromToken(token);
    }
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    sendUnauthorized(res, message);
  }
}
