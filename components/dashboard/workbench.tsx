"use client";

import { useMemo, useState } from "react";
import { Plus, Users2, Clock3, CheckCircle2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PositionSwitcher } from "./position-switcher";
import { AddCandidateDialog } from "./add-candidate-dialog";
import { KanbanBoard } from "./kanban-board";
import { CandidateDrawer } from "./candidate-drawer";
import { useOperatorName } from "./use-operator";
import { BOARD_COLUMNS } from "@/lib/constants";
import type { Candidate, Position } from "@/lib/types";

interface WorkbenchProps {
  positions: Position[];
  candidates: Candidate[];
}

export function Workbench({ positions, candidates }: WorkbenchProps) {
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [operatorName, setOperatorName] = useOperatorName();

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: candidates.length };
    for (const p of positions) map[p.id] = 0;
    for (const c of candidates) {
      map[c.position_id] = (map[c.position_id] ?? 0) + 1;
    }
    return map;
  }, [candidates, positions]);

  const filtered = useMemo(() => {
    const byPosition =
      positionFilter === "all"
        ? candidates
        : candidates.filter((c) => c.position_id === positionFilter);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return byPosition;

    return byPosition.filter((c) => {
      const posTitle = c.position?.title ?? "";
      return (
        c.name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        posTitle.toLowerCase().includes(q)
      );
    });
  }, [candidates, positionFilter, searchQuery]);

  // 概览统计
  const stats = useMemo(() => {
    const s = { total: filtered.length, interviewing: 0, closed: 0 };
    for (const c of filtered) {
      if (BOARD_COLUMNS[1].statuses.includes(c.status)) s.interviewing++;
      if (BOARD_COLUMNS[2].statuses.includes(c.status)) s.closed++;
    }
    return s;
  }, [filtered]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      {/* 概览统计卡 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Users2 className="h-4 w-4" />}
          label="候选人总数"
          value={stats.total}
          tone="emerald"
        />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          label="面试中"
          value={stats.interviewing}
          tone="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="已结束"
          value={stats.closed}
          tone="violet"
        />
      </div>

      {/* 顶部操作区 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PositionSwitcher
          positions={positions}
          value={positionFilter}
          onChange={setPositionFilter}
          counts={counts}
        />
        <div className="relative sm:ml-2 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜姓名 / 状态 / 岗位…"
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="shrink-0 sm:ml-auto"
        >
          <Plus className="h-4 w-4" />
          录入简历
        </Button>
      </div>

      {/* 核心内容区：三列看板 */}
      <KanbanBoard
        candidates={filtered}
        onSelect={(c) => setSelectedId(c.id)}
      />

      <AddCandidateDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        positions={positions}
      />

      <CandidateDrawer
        candidate={selected}
        onClose={() => setSelectedId(null)}
        operatorName={operatorName}
        onOperatorChange={setOperatorName}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "blue" | "violet";
}) {
  const toneMap = {
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 card-soft">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneMap[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
