"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  className?: string;
}

/**
 * 两个 Tab 共用的筛选下拉：
 * 统一高度/圆角/描边/聚焦态，杜绝各页面原生 select 样式不一致
 */
export function FilterSelect({
  icon: Icon,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: FilterSelectProps) {
  return (
    <div className={cn("relative", className)}>
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-input bg-white pl-9 pr-8 text-sm text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
