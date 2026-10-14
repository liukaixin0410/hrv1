import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, Users, TriangleAlert } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import { Workbench } from "@/components/dashboard/workbench";
import type { Candidate, Position } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const valid = await verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value
  );
  if (!valid) redirect("/login");

  let positions: Position[] = [];
  let candidates: Candidate[] = [];
  let loadError: string | null = null;

  try {
    const sb = getSupabase();
    const [positionsRes, candidatesRes] = await Promise.all([
      sb.from("positions").select("*").order("created_at"),
      sb
        .from("candidates")
        .select(
          "*, position:positions(*), interviews(*), status_logs:candidate_status_logs(*)"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (positionsRes.error) throw positionsRes.error;
    if (candidatesRes.error) throw candidatesRes.error;

    positions = (positionsRes.data ?? []) as Position[];
    candidates = (candidatesRes.data ?? []) as Candidate[];
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "数据库连接失败，请检查配置";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight tracking-tight">
                招聘工作台
              </h1>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Phase 1 · 全员协作
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loadError ? (
          <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <TriangleAlert className="h-5 w-5" />
              无法连接 Supabase 数据库
            </div>
            <p className="mt-3 text-sm text-amber-800">
              请确认已完成以下配置：
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-800">
              <li>
                在 Supabase 的 SQL Editor 中执行{" "}
                <code className="rounded bg-amber-100 px-1">
                  supabase/schema.sql
                </code>
              </li>
              <li>
                在项目根目录{" "}
                <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
                中配置 NEXT_PUBLIC_SUPABASE_URL 与
                SUPABASE_SERVICE_ROLE_KEY
              </li>
              <li>重启开发服务器</li>
            </ol>
            <p className="mt-3 break-all text-xs text-amber-700">
              错误信息：{loadError}
            </p>
          </div>
        ) : (
          <Workbench positions={positions} candidates={candidates} />
        )}
      </main>
    </div>
  );
}
