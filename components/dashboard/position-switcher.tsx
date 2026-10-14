"use client";

import { cn } from "@/lib/utils";
import type { Position } from "@/lib/types";

interface PositionSwitcherProps {
  positions: Position[];
  value: string;
  onChange: (id: string) => void;
  counts: Record<string, number>;
}

export function PositionSwitcher({
  positions,
  value,
  onChange,
  counts,
}: PositionSwitcherProps) {
  const tabs = [
    { id: "all", title: "全部岗位" },
    ...positions.map((p) => ({ id: p.id, title: p.title })),
  ];

  return (
    <div className="flex flex-1 gap-2 overflow-x-auto thin-scrollbar pb-0.5">
      {tabs.map((tab) => {
        const active = value === tab.id;
        const count = counts[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-[0.97]",
              active
                ? "border-transparent bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25"
                : "border-border bg-white text-muted-foreground hover:border-emerald-300 hover:text-emerald-600"
            )}
          >
            {tab.title}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
