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
 * 将 ISO 时间（或任何可解析的时间值）转换为北京时间（Asia/Shanghai）
 * 的 yyyy/MM/dd HH:mm 文本，供服务端写日志备注使用。
 * 服务器运行时区可能是 UTC，不能直接用 toLocaleString 默认时区。
 */
export function formatInterviewTimeBeijing(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get(
      "minute"
    )}`;
  } catch {
    return null;
  }
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
