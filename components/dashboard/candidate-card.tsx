"use client";

import { CalendarClock, FileText, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TERMINAL_STATUSES, statusBadgeClass } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import type { Candidate } from "@/lib/types";

// 按姓氏分配头像渐变色（Boss风格彩色头像）
const AVATAR_GRADIENTS = [
  "from-emerald-400 to-emerald-600",
  "from-blue-400 to-blue-600",
  "from-violet-400 to-violet-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-teal-600",
];

function avatarGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

interface CandidateCardProps {
  candidate: Candidate;
  onClick: () => void;
}

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  const upcoming = candidate.interviews
    ?.filter((i) => i.scheduled_time)
    .sort(
      (a, b) =>
        new Date(a.scheduled_time!).getTime() -
        new Date(b.scheduled_time!).getTime()
    )[0];

  // 仅“仍在排期中但时间已过”才红色告警；已结束流程中的历史时间用中性灰
  const overdue = upcoming
    ? !TERMINAL_STATUSES.includes(candidate.status) &&
      new Date(upcoming.scheduled_time!).getTime() < Date.now()
    : false;
  const historical = upcoming
    ? TERMINAL_STATUSES.includes(candidate.status)
    : false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group w-full cursor-pointer rounded-xl border border-slate-100 bg-white p-3 text-left outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm ${avatarGradient(
              candidate.name
            )}`}
          >
            {candidate.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {candidate.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {candidate.position?.title ?? "未分配岗位"}
            </p>
          </div>
        </div>
        <Badge className={statusBadgeClass(candidate.status)}>
          {candidate.status}
        </Badge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {candidate.resume_url ? (
          <a
            href={candidate.resume_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="点击打开简历附件"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600"
          >
            <Paperclip className="h-3 w-3" />
            简历附件
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
            <FileText className="h-3 w-3" />
            文本简历
          </span>
        )}
        {upcoming && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              overdue
                ? "bg-rose-50 text-rose-600"
                : historical
                  ? "bg-slate-100 text-slate-500"
                  : "bg-blue-50 text-blue-600"
            )}
            title={overdue ? "面试时间已过，请尽快跟进" : undefined}
          >
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(upcoming.scheduled_time)}
            {overdue && <span className="font-semibold">· 已过期</span>}
          </span>
        )}
      </div>
    </div>
  );
}
