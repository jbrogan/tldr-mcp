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
 * Decode a JWT's payload without verifying the signature.
 * Used for diagnostic logging only — never for auth decisions.
 */
function inspectJwt(token: string): {
  aud?: string | string[];
  sub?: string;
  hasClientId: boolean;
  iss?: string;
} {
  try {
    const payload = token.split(".")[1];
    if (!payload) return { hasClientId: false };
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const claims = JSON.parse(json) as Record<string, unknown>;
    return {
      aud: claims.aud as string | string[] | undefined,
      sub: claims.sub as string | undefined,
      iss: claims.iss as string | undefined,
      hasClientId: "client_id" in claims,
    };
  } catch {
    return { hasClientId: false };
  }
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
  const ua = req.headers["user-agent"] ?? "unknown";
  const path = req.path;

  if (!authHeader?.startsWith("Bearer ")) {
    console.error(`[auth] path=${path} ua="${ua}" result=fail reason=no_bearer`);
    sendUnauthorized(res, "Missing or invalid Authorization header");
    return;
  }

  const token = authHeader.slice(7);
  const tokenType = isApiToken(token) ? "api" : "jwt";

  try {
    if (isApiToken(token)) {
      const userId = await findUserIdByToken(token);
      if (!userId) {
        console.error(`[auth] path=${path} ua="${ua}" type=api result=fail reason=invalid_api_token`);
        sendUnauthorized(res, "Invalid or expired API token");
        return;
      }
      req.storeContext = await createContextFromUserId(userId);
      console.error(`[auth] path=${path} ua="${ua}" type=api result=ok user=${userId}`);
    } else {
      const claims = inspectJwt(token);
      req.storeContext = await createContextFromToken(token);
      console.error(
        `[auth] path=${path} ua="${ua}" type=jwt result=ok user=${req.storeContext.userId} aud=${JSON.stringify(claims.aud)} has_client_id=${claims.hasClientId}`,
      );
    }
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    const claims = tokenType === "jwt" ? inspectJwt(token) : null;
    console.error(
      `[auth] path=${path} ua="${ua}" type=${tokenType} result=fail reason="${message}"${claims ? ` aud=${JSON.stringify(claims.aud)} has_client_id=${claims.hasClientId}` : ""}`,
    );
    sendUnauthorized(res, message);
  }
}
