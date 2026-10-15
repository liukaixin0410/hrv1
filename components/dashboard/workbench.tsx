"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Users2,
  Clock3,
  CheckCircle2,
  Search,
  X,
  CalendarClock,
  KanbanSquare,
  BriefcaseBusiness,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PositionSwitcher } from "./position-switcher";
import { AddCandidateDialog } from "./add-candidate-dialog";
import { PositionManageDialog } from "./position-manage-dialog";
import { KanbanBoard } from "./kanban-board";
import { ScheduleView } from "./interview-schedule";
import { CandidateDrawer } from "./candidate-drawer";
import { useOperatorName } from "./use-operator";
import { BOARD_COLUMNS } from "@/lib/constants";
import type { Candidate, Interviewer, Position } from "@/lib/types";

interface WorkbenchProps {
  positions: Position[];
  interviewers: Interviewer[];
  candidates: Candidate[];
}

type TabKey = "board" | "schedule";

export function Workbench({
  positions,
  interviewers,
  candidates,
}: WorkbenchProps) {
  const [tab, setTab] = useState<TabKey>("board");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
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

  // 今日及以后待进行的面试数（用于日程 Tab 角标）
  const upcomingCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    const t = cutoff.getTime();
    let n = 0;
    for (const c of candidates) {
      for (const i of c.interviews ?? []) {
        if (!i.scheduled_time) continue;
        if (new Date(i.scheduled_time).getTime() < t) continue;
        const pending = i.round === 1 ? "初试排期" : "复试排期";
        if (c.status === pending) n++;
      }
    }
    return n;
  }, [candidates]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      {/* 双 Tab 切换 */}
      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <TabButton
          active={tab === "board"}
          onClick={() => setTab("board")}
          icon={<KanbanSquare className="h-4 w-4" />}
          label="候选人看板"
        />
        <TabButton
          active={tab === "schedule"}
          onClick={() => setTab("schedule")}
          icon={<CalendarClock className="h-4 w-4" />}
          label="面试日程表"
          badge={upcomingCount}
        />
      </div>

      {tab === "board" ? (
        <>
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
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <PositionSwitcher
              positions={positions}
              value={positionFilter}
              onChange={setPositionFilter}
              counts={counts}
            />
            <div className="relative lg:ml-2 lg:w-64">
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
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => setManageOpen(true)}
                className="shrink-0"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                岗位管理
              </Button>
              <Button onClick={() => setAddOpen(true)} className="shrink-0">
                <Plus className="h-4 w-4" />
                录入简历
              </Button>
            </div>
          </div>

          {/* 核心内容区：三列看板 */}
          <KanbanBoard
            candidates={filtered}
            onSelect={(c) => setSelectedId(c.id)}
          />
        </>
      ) : (
        <ScheduleView
          candidates={candidates}
          positions={positions}
          interviewers={interviewers}
          onSelect={(id) => setSelectedId(id)}
        />
      )}

      <AddCandidateDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        positions={positions}
      />

      <PositionManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        positions={positions}
      />

      {/* 抽屉跨 Tab 共享：从日程点入也能直接唤起 */}
      <CandidateDrawer
        candidate={selected}
        onClose={() => setSelectedId(null)}
        operatorName={operatorName}
        onOperatorChange={setOperatorName}
        interviewerNames={interviewers.map((i) => i.name)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-emerald-500 text-white shadow-sm"
          : "text-muted-foreground hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
            active ? "bg-white/25 text-white" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
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
