#!/usr/bin/env node

/**
 * End-to-end test for the HTTP MCP server.
 *
 * Usage:
 *   1. Start the server:  npm run start:http
 *   2. Run this script:   node scripts/test-http.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in .env (loaded automatically).
 */

import "dotenv/config";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EMAIL = "jbrogan58@gmail.com";
const PASSWORD = "testing";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

async function step(label, fn) {
  process.stdout.write(`\n→ ${label}... `);
  try {
    const result = await fn();
    console.log("OK");
    return result;
  } catch (err) {
    console.log("FAIL");
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  // Step 1: Health check
  await step("Health check", async () => {
    const res = await fetch(`${SERVER_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    console.log(JSON.stringify(body));
  });

  // Step 2: Sign in to get JWT
  const accessToken = await step("Sign in to Supabase", async () => {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error_description || body.msg || JSON.stringify(body));
    console.log(`user=${body.user?.id}`);
    return body.access_token;
  });

  // Step 3: Initialize MCP session
  const sessionId = await step("Initialize MCP session", async () => {
    const res = await fetch(`${SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-script", version: "1.0.0" },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const sid = res.headers.get("mcp-session-id");
    console.log(`session=${sid}`);
    return sid;
  });

  // Step 4: Send initialized notification
  await step("Send initialized notification", async () => {
    const res = await fetch(`${SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    if (!res.ok && res.status !== 202 && res.status !== 204) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  });

  // Step 5: Call list_areas tool
  await step("Call list_areas tool", async () => {
    const res = await fetch(`${SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_areas", arguments: {} },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    // Response may be SSE or JSON depending on transport
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      // Parse SSE events to find the result
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.result) {
            console.log(JSON.stringify(data.result, null, 2).slice(0, 500));
          }
        }
      }
    } else {
      const body = await res.json();
      console.log(JSON.stringify(body.result || body, null, 2).slice(0, 500));
    }
  });

  // Step 6: Call list_ends tool
  await step("Call list_ends tool", async () => {
    const res = await fetch(`${SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_ends", arguments: {} },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (data.result) {
            console.log(JSON.stringify(data.result, null, 2).slice(0, 500));
          }
        }
      }
    } else {
      const body = await res.json();
      console.log(JSON.stringify(body.result || body, null, 2).slice(0, 500));
    }
  });

  console.log("\n✅ All tests passed!\n");
}

main();
