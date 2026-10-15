"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  Settings2,
  UserCog,
} from "lucide-react";
import type { Candidate, Interviewer, Position } from "@/lib/types";
import { ROUND_DOT_CLASS, ROUND_LABEL } from "@/lib/constants";
import { FilterSelect } from "./filter-select";
import { InterviewerManageDialog } from "./interviewer-manage-dialog";

interface ScheduleViewProps {
  candidates: Candidate[];
  positions: Position[];
  interviewers: Interviewer[];
  onSelect: (candidateId: string) => void;
}

interface ScheduleItem {
  candidate: Candidate;
  round: 1 | 2;
  time: string; // ISO
  interviewer: string | null;
}

/** 面试官筛选值：all=全部，__none__=未分配，其余为姓名 */
const INTERVIEWER_ALL = "all";
const INTERVIEWER_NONE = "__none__";

/** 周一为一周起点 */
const WEEK_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];
const MAX_VISIBLE_PER_DAY = 2;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 本地日期 key（不补零也保持一致即可） */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ScheduleView({
  candidates,
  positions,
  interviewers,
  onSelect,
}: ScheduleViewProps) {
  const [positionId, setPositionId] = useState<string>("all");
  const [interviewerFilter, setInterviewerFilter] =
    useState<string>(INTERVIEWER_ALL);
  const [manageOpen, setManageOpen] = useState(false);
  // 日历当前查看的月份（只取年月）
  const [cursor, setCursor] = useState<Date>(startOfToday());

  // 面试官筛选候选：以名册为准，并并入日程中出现的历史遗留姓名
  const interviewerOptions = useMemo(() => {
    const set = new Set(interviewers.map((p) => p.name));
    const cutoff = startOfToday().getTime();
    for (const c of candidates) {
      for (const i of c.interviews ?? []) {
        const pending = i.round === 1 ? "初试排期" : "复试排期";
        if (
          c.status === pending &&
          i.scheduled_time &&
          new Date(i.scheduled_time).getTime() >= cutoff &&
          i.interviewer?.trim()
        ) {
          set.add(i.interviewer.trim());
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [interviewers, candidates]);

  const items = useMemo<ScheduleItem[]>(() => {
    const cutoff = startOfToday().getTime();
    return candidates
      .filter(
        (c) => !positionId || positionId === "all" || c.position_id === positionId
      )
      .flatMap((c) =>
        (c.interviews ?? [])
          .filter((i) => {
            if (!i.scheduled_time) return false;
            if (new Date(i.scheduled_time).getTime() < cutoff) return false;
            // 仅展示“待进行”的面试：候选人当前仍处于该轮排期状态
            const pendingStatus = i.round === 1 ? "初试排期" : "复试排期";
            return c.status === pendingStatus;
          })
          .map((i) => ({
            candidate: c,
            round: i.round as 1 | 2,
            time: i.scheduled_time as string,
            interviewer: i.interviewer?.trim() || null,
          }))
      )
      .filter((item) => {
        if (interviewerFilter === INTERVIEWER_ALL) return true;
        if (interviewerFilter === INTERVIEWER_NONE)
          return item.interviewer === null;
        return item.interviewer === interviewerFilter;
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [candidates, positionId, interviewerFilter]);

  // 日期 key -> 当日面试（items 已按时间升序）
  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = dateKey(new Date(item.time));
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  // 月历 6×7 格子（周一起）
  const cells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(y, m, 1 - lead + i);
      return { date: d, inMonth: d.getMonth() === m, key: dateKey(d) };
    });
  }, [cursor]);

  const todayKey = dateKey(new Date());
  const todayCount = itemsByDay.get(todayKey)?.length ?? 0;
  const monthCount = cells.reduce(
    (n, cell) => (cell.inMonth ? n + (itemsByDay.get(cell.key)?.length ?? 0) : n),
    0
  );
  const isCurrentMonth =
    cursor.getFullYear() === new Date().getFullYear() &&
    cursor.getMonth() === new Date().getMonth();

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-4">
      {/* 过滤栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          月历展示待进行的面试，点击面试可直达候选人详情
          {todayCount > 0 && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              今天 {todayCount} 场
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            icon={UserCog}
            ariaLabel="按面试官筛选"
            className="w-40"
            value={interviewerFilter}
            onChange={setInterviewerFilter}
            options={[
              { value: INTERVIEWER_ALL, label: "全部面试官" },
              { value: INTERVIEWER_NONE, label: "未分配面试官" },
              ...interviewerOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <FilterSelect
            icon={Filter}
            ariaLabel="按岗位筛选"
            className="w-40"
            value={positionId}
            onChange={setPositionId}
            options={[
              { value: "all", label: "全部岗位" },
              ...positions.map((p) => ({
                value: p.id,
                label: `${p.title}${p.status === "closed" ? "（已停用）" : ""}`,
              })),
            ]}
          />
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600"
          >
            <Settings2 className="h-3.5 w-3.5" />
            面试官管理
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Inbox className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">
              暂无待进行的面试安排
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              在候选人详情中推进到初试/复试并选择时间后，这里会自动出现
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          {/* 月份导航 */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold tracking-tight">
                {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
              </h3>
              <span className="ml-1 text-xs text-muted-foreground">
                本月 {monthCount} 场
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => setCursor(startOfToday())}
                  className="mr-1 inline-flex h-8 items-center rounded-lg border border-input bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600"
                >
                  回到今天
                </button>
              )}
              <button
                type="button"
                aria-label="上一月"
                onClick={() => shiftMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-white text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一月"
                onClick={() => shiftMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-white text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 星期表头 */}
          <div className="grid grid-cols-7 gap-1">
            {WEEK_HEADERS.map((w) => (
              <div
                key={w}
                className="pb-1.5 text-center text-xs font-medium text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>

          {/* 日期格子 */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const dayItems = itemsByDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const visible = dayItems.slice(0, MAX_VISIBLE_PER_DAY);
              const hiddenCount = dayItems.length - visible.length;
              return (
                <div
                  key={cell.key}
                  className={`flex min-h-[74px] flex-col rounded-xl border p-1 sm:min-h-[104px] sm:p-1.5 ${
                    cell.inMonth
                      ? "border-slate-100 bg-white"
                      : "border-transparent bg-slate-50/60"
                  }`}
                >
                  <div className="mb-0.5 flex justify-end">
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5 ${
                        isToday
                          ? "bg-emerald-500 px-1.5 font-semibold text-white"
                          : cell.inMonth
                            ? dayItems.length > 0
                              ? "font-semibold text-slate-700"
                              : "text-slate-400"
                            : "text-slate-300"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    {visible.map((item) => {
                      const t = new Date(item.time);
                      const hhmm = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
                      return (
                        <button
                          key={`${item.candidate.id}-${item.round}`}
                          type="button"
                          onClick={() => onSelect(item.candidate.id)}
                          title={`${hhmm} ${item.candidate.name} · ${ROUND_LABEL[item.round]} · ${item.candidate.position?.title ?? "未知岗位"} · ${item.interviewer ?? "未分配面试官"}`}
                          className={`flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] leading-4 transition hover:bg-emerald-50 ${
                            cell.inMonth ? "" : "opacity-60"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${ROUND_DOT_CLASS[item.round]}`}
                          />
                          <span className="shrink-0 font-semibold tabular-nums text-slate-500">
                            {hhmm}
                          </span>
                          <span className="truncate text-slate-700">
                            {item.candidate.name}
                          </span>
                          {!item.interviewer && (
                            <span
                              title="未分配面试官"
                              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                            />
                          )}
                        </button>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{hiddenCount} 场
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <InterviewerManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        interviewers={interviewers}
      />
    </div>
  );
}
