"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, Sparkles, Users2 } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  const succeeded = !state.error;
  useEffect(() => {
    if (succeeded && !pending) {
      router.replace("/");
      router.refresh();
    }
  }, [succeeded, pending, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-4">
      {/* 背景装饰圆点 */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/4 h-40 w-40 rounded-full bg-violet-100/50 blur-2xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* 品牌区 */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-xl shadow-emerald-500/30">
            <Users2 className="h-8 w-8 text-white" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
              <Sparkles className="h-3 w-3 text-white" />
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            招聘与面试管理系统
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            让简历流转更高效 · 团队协作版
          </p>
        </div>

        {/* 登录卡片 */}
        <form
          action={formAction}
          className="rounded-2xl border bg-white/90 p-7 shadow-xl shadow-slate-900/5 backdrop-blur-sm"
        >
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            工作台密码
          </label>
          <div className="group relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              placeholder="请输入团队统一密码"
              className="h-11 w-full rounded-xl border border-input bg-white pl-11 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {state.error ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.99] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            进入工作台
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Phase 1 · 团队内部协作 · 数据全员可见
        </p>
      </div>
    </div>
  );
}
