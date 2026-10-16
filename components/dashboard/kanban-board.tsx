"use client";

import { Inbox } from "lucide-react";
import { BOARD_COLUMNS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CandidateCard } from "./candidate-card";
import type { Candidate } from "@/lib/types";

interface KanbanBoardProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
  /** 统计卡点击后需要高亮定位的列 key */
  highlightKey?: string | null;
  operatorName: string;
  onOperatorChange: (v: string) => void;
}

export function KanbanBoard({
  candidates,
  onSelect,
  highlightKey,
  operatorName,
  onOperatorChange,
}: KanbanBoardProps) {
  if (candidates.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200">
          <Inbox className="h-7 w-7 text-slate-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          当前筛选条件下暂无候选人
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          点击右上角「录入简历」，添加第一位候选人
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLUMNS.map((column) => {
        const items = candidates.filter((c) =>
          column.statuses.includes(c.status)
        );
        const highlighted = highlightKey === column.key;
        return (
          <section
            key={column.key}
            id={`board-column-${column.key}`}
            className={cn(
              "flex min-h-0 scroll-mt-24 flex-col rounded-2xl transition-shadow duration-500",
              highlighted && "ring-2 ring-emerald-400 ring-offset-2"
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={`h-2.5 w-2.5 rounded-full ${column.dotClass}`} />
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                {items.length}
              </span>
            </div>
            <div
              className={cn(
                "flex flex-1 flex-col gap-2.5 rounded-2xl p-2.5 ring-1 transition-colors duration-500",
                highlighted ? "bg-emerald-50/60 ring-emerald-200" : "bg-slate-50/80 ring-slate-100"
              )}
            >
              {items.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-muted-foreground">
                  暂无候选人
                </div>
              ) : (
                items.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onClick={() => onSelect(candidate)}
                    operatorName={operatorName}
                    onOperatorChange={onOperatorChange}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
