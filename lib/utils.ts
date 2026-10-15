import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ISO 时间 -> datetime-local 输入框所需的本地时间字符串 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 将 datetime-local 原始值（浏览器本地时间，如 2026-10-16T10:00）
 * 格式化为 yyyy/MM/dd HH:mm。不做任何时区转换，
 * 供服务端写日志备注时使用（服务器运行时区可能为 UTC）。
 */
export function formatLocalDateTime(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}

/** 中文环境的完整时间展示 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "未安排";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未安排";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 从简历 URL 推断文件类型 */
export function resumeKind(
  url: string | null | undefined
): "pdf" | "image" | "other" {
  if (!url) return "other";
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/.test(u)) return "image";
  return "other";
}
