"use client";

import { useMemo, useRef, useState } from "react";
import {
  Inbox,
  Clock3,
  CircleCheck,
  CircleSlash,
  Search,
  X,
  CalendarClock,
  KanbanSquare,
  BriefcaseBusiness,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "./filter-select";
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
  // 统计卡点击后高亮的看板列
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // 概览统计：待筛 / 面试中 / 面试通过 / 面试不通过（与看板四列口径一致）
  const stats = useMemo(() => {
    const count = (key: string) =>
      filtered.filter((c) =>
        BOARD_COLUMNS.find((col) => col.key === key)!.statuses.includes(c.status)
      ).length;
    return {
      screening: count("screening"),
      interviewing: count("interviewing"),
      passed: count("passed"),
      rejected: count("rejected"),
    };
  }, [filtered]);

  /** 点击统计卡：平滑滚动到对应看板列并短暂高亮 */
  function jumpToColumn(key: string) {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightKey(key);
    requestAnimationFrame(() => {
      document
        .getElementById(`board-column-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    highlightTimer.current = setTimeout(() => setHighlightKey(null), 1800);
  }

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
          {/* 概览统计卡（点击定位到对应看板列） */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Inbox className="h-4 w-4" />}
              label="待筛"
              value={stats.screening}
              tone="slate"
              onClick={() => jumpToColumn("screening")}
            />
            <StatCard
              icon={<Clock3 className="h-4 w-4" />}
              label="面试中"
              value={stats.interviewing}
              tone="blue"
              onClick={() => jumpToColumn("interviewing")}
            />
            <StatCard
              icon={<CircleCheck className="h-4 w-4" />}
              label="面试通过"
              value={stats.passed}
              tone="emerald"
              onClick={() => jumpToColumn("passed")}
            />
            <StatCard
              icon={<CircleSlash className="h-4 w-4" />}
              label="面试不通过"
              value={stats.rejected}
              tone="rose"
              onClick={() => jumpToColumn("rejected")}
            />
          </div>

          {/* 顶部操作区 */}
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <FilterSelect
              icon={BriefcaseBusiness}
              ariaLabel="按岗位筛选"
              className="w-full lg:w-48"
              value={positionFilter}
              onChange={setPositionFilter}
              options={[
                { value: "all", label: `全部岗位 ${counts.all ?? 0}` },
                ...positions.map((p) => ({
                  value: p.id,
                  label: `${p.title}${p.status === "closed" ? "（已停用）" : ""} ${counts[p.id] ?? 0}`,
                })),
              ]}
            />
            <div className="relative lg:w-64">
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

          {/* 核心内容区：四列看板 */}
          <KanbanBoard
            candidates={filtered}
            onSelect={(c) => setSelectedId(c.id)}
            highlightKey={highlightKey}
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "slate" | "emerald" | "blue" | "rose";
  onClick: () => void;
}) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-600 ring-slate-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={`定位到「${label}」`}
      className="group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left card-soft transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105 ${toneMap[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </button>
  );
}
