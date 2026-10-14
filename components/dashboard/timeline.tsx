"use client";

import {
  CircleCheck,
  CircleSlash,
  Clock3,
  FilePlus2,
  Handshake,
  CircleDashed,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { StatusLog } from "@/lib/types";

function timelineIcon(toStatus: string) {
  switch (toStatus) {
    case "录用":
      return <Handshake className="h-3.5 w-3.5 text-emerald-600" />;
    case "已淘汰":
      return <CircleSlash className="h-3.5 w-3.5 text-rose-500" />;
    case "初试完成":
    case "复试完成":
      return <CircleCheck className="h-3.5 w-3.5 text-indigo-600" />;
    case "初试排期":
    case "复试排期":
      return <Clock3 className="h-3.5 w-3.5 text-blue-600" />;
    case "待筛":
      return <FilePlus2 className="h-3.5 w-3.5 text-slate-500" />;
    default:
      return <CircleDashed className="h-3.5 w-3.5 text-slate-400" />;
  }
}

export function Timeline({ logs }: { logs: StatusLog[] }) {
  const ordered = [...logs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无流转记录</p>;
  }

  return (
    <ol className="relative space-y-4 pl-1">
      {ordered.map((log, idx) => (
        <li key={log.id} className="relative flex gap-3">
          {idx !== ordered.length - 1 && (
            <span className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-px bg-slate-200" />
          )}
          <span className="z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            {timelineIcon(log.to_status)}
          </span>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-foreground">
                {log.to_status}
              </span>
              {log.from_status && log.from_status !== log.to_status && (
                <span className="text-xs text-muted-foreground">
                  {log.from_status} → {log.to_status}
                </span>
              )}
            </div>
            {log.note && (
              <p className="mt-0.5 text-sm text-muted-foreground">{log.note}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDateTime(log.created_at)}
              {log.operator_name ? ` · 操作人 ${log.operator_name}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
