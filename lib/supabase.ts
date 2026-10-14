import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * 仅允许在 Server Component / Server Action / Route Handler 中调用。
 * Phase 1 使用 service_role key（绕过 RLS），密钥只存在于服务端环境变量。
 */
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "缺少 Supabase 环境变量：请在 .env.local 中配置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
