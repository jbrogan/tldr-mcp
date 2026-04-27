/**
 * Runtime configuration — initialized by the Worker entry point,
 * consumed by store and utility modules.
 *
 * Replaces process.env access for Cloudflare Workers compatibility.
 */

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  supabaseSigningKeyJwk?: string;
  anthropicApiKey?: string;
}

let config: AppConfig | null = null;

export function setConfig(c: AppConfig): void {
  config = c;
}

export function getConfig(): AppConfig {
  if (!config) throw new Error("Config not initialized — call setConfig() before using store functions");
  return config;
}
