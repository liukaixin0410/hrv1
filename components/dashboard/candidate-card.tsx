"use client";

import { CalendarClock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
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

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5"
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

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {candidate.resume_url ? "简历附件" : "文本简历"}
        </span>
        {upcoming && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(upcoming.scheduled_time)}
          </span>
        )}
      </div>
    </button>
  );
}
