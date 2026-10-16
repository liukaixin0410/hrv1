"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  List,
  Pencil,
  Settings2,
  UserCog,
} from "lucide-react";
import type { Candidate, Interviewer, Position } from "@/lib/types";
import {
  ROUND_CHIP_CLASS,
  ROUND_DOT_CLASS,
  ROUND_LABEL,
} from "@/lib/constants";
import { cn, toLocalInputValue } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "./filter-select";
import { InterviewerManageDialog } from "./interviewer-manage-dialog";
import { rescheduleInterviewAction } from "@/app/actions";

interface ScheduleViewProps {
  /** 已按岗位/面试官筛选后的候选人（日程条目从此派生） */
  candidates: Candidate[];
  /** 全部候选人（仅用于构建面试官筛选选项，避免被当前岗位筛选收窄） */
  allCandidates: Candidate[];
  positions: Position[];
  interviewers: Interviewer[];
  positionFilter: string;
  onPositionFilterChange: (v: string) => void;
  interviewerFilter: string;
  onInterviewerFilterChange: (v: string) => void;
  onSelect: (candidateId: string) => void;
  /** 操作人签名（改期日志用） */
  operatorName: string;
  onOperatorChange: (v: string) => void;
}

interface ScheduleItem {
  candidate: Candidate;
  round: 1 | 2;
  /** ISO；null=时间暂定（待确认），只出现在“时间待确认”分区 */
  time: string | null;
  interviewer: string | null;
}

type ViewMode = "list" | "calendar";

/** 面试官筛选值：all=全部，__none__=未分配，其余为姓名 */
export const INTERVIEWER_ALL = "all";
export const INTERVIEWER_NONE = "__none__";
const VIEW_STORAGE_KEY = "schedule-view";

/** 周一为一周起点 */
const WEEK_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MAX_VISIBLE_PER_DAY = 2;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 本地日期 key */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 与“今天 0 点”的天数差：今天=0，明天=1 */
function dayDiff(iso: string): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((a - startOfToday().getTime()) / 86_400_000);
}

function dayLabel(diff: number): string {
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  return "";
}

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "list";
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === "calendar"
    ? "calendar"
    : "list";
}

export function ScheduleView({
  candidates,
  allCandidates,
  positions,
  interviewers,
  positionFilter,
  onPositionFilterChange,
  interviewerFilter,
  onInterviewerFilterChange,
  onSelect,
  operatorName,
  onOperatorChange,
}: ScheduleViewProps) {
  const router = useRouter();
  const [manageOpen, setManageOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>(readInitialView);
  // 日历当前查看的月份
  const [cursor, setCursor] = useState<Date>(startOfToday());
  // 日历格「+N 场」点开的当日清单
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  // 改期弹窗
  const [rescheduleItem, setRescheduleItem] = useState<ScheduleItem | null>(
    null
  );
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  }

  // 面试官筛选候选：以名册为准，并并入日程中出现的历史遗留姓名
  const interviewerOptions = useMemo(() => {
    const set = new Set(interviewers.map((p) => p.name));
    const cutoff = startOfToday().getTime();
    for (const c of allCandidates) {
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
  }, [interviewers, allCandidates]);

  const items = useMemo<ScheduleItem[]>(() => {
    const cutoff = startOfToday().getTime();
    return candidates
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
        // 条目级精确过滤（候选人级过滤在父组件完成，这里保证多面试官候选人不错显）
        if (interviewerFilter === INTERVIEWER_ALL) return true;
        if (interviewerFilter === INTERVIEWER_NONE)
          return item.interviewer === null;
        return item.interviewer === interviewerFilter;
      })
      .sort((a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime());
  }, [candidates, interviewerFilter]);

  /**
   * 暂定条目：处于初/复试排期但未确认时间（当前业务上只有“复试暂定”）。
   * 无法进入日历格，统一在顶部“时间待确认”分区提示并提供补录入口。
   */
  const pendingItems = useMemo<ScheduleItem[]>(() => {
    return candidates
      .flatMap((c) =>
        (c.interviews ?? [])
          .filter((i) => {
            if (i.scheduled_time) return false;
            const pendingStatus =
              i.round === 1 ? "初试排期" : "复试排期";
            return c.status === pendingStatus;
          })
          .map((i) => ({
            candidate: c,
            round: Number(i.round) as 1 | 2,
            time: null,
            interviewer: i.interviewer?.trim() || null,
          }))
      )
      .filter((item) => {
        if (interviewerFilter === INTERVIEWER_ALL) return true;
        if (interviewerFilter === INTERVIEWER_NONE)
          return item.interviewer === null;
        return item.interviewer === interviewerFilter;
      });
  }, [candidates, interviewerFilter]);

  // 日期 key -> 当日面试（items 已按时间升序）
  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = dateKey(new Date(item.time!));
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  // 列表视图：按天分组
  const groups = useMemo(() => Array.from(itemsByDay.entries()), [itemsByDay]);

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
    (n, cell) =>
      cell.inMonth ? n + (itemsByDay.get(cell.key)?.length ?? 0) : n,
    0
  );
  const isCurrentMonth =
    cursor.getFullYear() === new Date().getFullYear() &&
    cursor.getMonth() === new Date().getMonth();
  const dayModalItems = dayModalKey
    ? itemsByDay.get(dayModalKey) ?? []
    : [];

  function shiftMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function openCandidate(candidateId: string) {
    setDayModalKey(null);
    onSelect(candidateId);
  }

  function openReschedule(item: ScheduleItem) {
    setRescheduleItem(item);
    setRescheduleValue(toLocalInputValue(item.time));
    setRescheduleError(null);
  }

  async function confirmReschedule() {
    if (!rescheduleItem) return;
    if (!rescheduleValue) {
      setRescheduleError("请选择新的面试时间");
      return;
    }
    if (Number.isNaN(new Date(rescheduleValue).getTime())) {
      setRescheduleError("面试时间格式不正确");
      return;
    }
    setRescheduleSaving(true);
    setRescheduleError(null);
    const result = await rescheduleInterviewAction({
      candidateId: rescheduleItem.candidate.id,
      round: rescheduleItem.round,
      scheduledTime: rescheduleValue,
      operatorName,
    });
    setRescheduleSaving(false);
    if (!result.ok) {
      setRescheduleError(result.error ?? "改期失败");
      return;
    }
    onOperatorChange(operatorName.trim());
    setRescheduleItem(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* 过滤栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {viewMode === "list"
            ? "展示今天及以后待进行的面试，按时间升序排列"
            : "月历展示待进行的面试，点击面试可直达候选人详情"}
          {todayCount > 0 && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              今天 {todayCount} 场
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* 列表 / 日历 视图切换 */}
          <div className="inline-flex rounded-lg border border-input bg-white p-0.5 shadow-sm">
            <ViewToggle
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
              icon={<List className="h-3.5 w-3.5" />}
              label="列表"
            />
            <ViewToggle
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="日历"
            />
          </div>
          <FilterSelect
            icon={UserCog}
            ariaLabel="按面试官筛选"
            className="w-40"
            value={interviewerFilter}
            onChange={onInterviewerFilterChange}
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
            value={positionFilter}
            onChange={onPositionFilterChange}
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

      {/* 时间待确认：已推进到排期但时间暂定的面试，列表/日历视图都置顶提示 */}
      {pendingItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 shadow-sm sm:p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-800">
              时间待确认
              <span className="ml-1.5 text-xs font-normal text-amber-600">
                {pendingItems.length} 场
              </span>
            </h3>
            <span className="text-xs text-amber-600/80">
              已推进流程但面试时间未定，确认时间后自动进入下方日程
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {pendingItems.map((item) => (
              <ScheduleRow
                key={`pending-${item.candidate.id}-${item.round}`}
                item={item}
                onClick={() => openCandidate(item.candidate.id)}
                onReschedule={() => openReschedule(item)}
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        pendingItems.length === 0 ? (
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
        ) : null
      ) : viewMode === "list" ? (
        /* ---------------- 列表视图（默认） ---------------- */
        <div className="space-y-5">
          {groups.map(([key, dayItems]) => {
            const diff = dayDiff(dayItems[0].time!);
            const d = new Date(dayItems[0].time!);
            return (
              <div key={key}>
                {/* 日期分组头 */}
                <div className="mb-2 flex items-center gap-2">
                  <CalendarClock
                    className={cn(
                      "h-4 w-4",
                      diff <= 1 ? "text-emerald-500" : "text-slate-400"
                    )}
                  />
                  <h3 className="text-sm font-semibold">
                    {dayLabel(diff) ||
                      `${d.getMonth() + 1}月${d.getDate()}日`}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {WEEKDAYS[d.getDay()]}
                    </span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {dayItems.length} 场
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* 日程卡片 */}
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {dayItems.map((item) => (
                    <ScheduleRow
                      key={`${item.candidate.id}-${item.round}`}
                      item={item}
                      onClick={() => openCandidate(item.candidate.id)}
                      onReschedule={() => openReschedule(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---------------- 日历视图 ---------------- */
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
                  className={cn(
                    "flex min-h-[74px] flex-col rounded-xl border p-1 sm:min-h-[104px] sm:p-1.5",
                    cell.inMonth
                      ? "border-slate-100 bg-white"
                      : "border-transparent bg-slate-50/60"
                  )}
                >
                  <div className="mb-0.5 flex justify-end">
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5",
                        isToday
                          ? "bg-emerald-500 px-1.5 font-semibold text-white"
                          : cell.inMonth
                            ? dayItems.length > 0
                              ? "font-semibold text-slate-700"
                              : "text-slate-400"
                            : "text-slate-300"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    {visible.map((item) => {
                      const t = new Date(item.time!);
                      const hhmm = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
                      return (
                        <div
                          key={`${item.candidate.id}-${item.round}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openCandidate(item.candidate.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCandidate(item.candidate.id);
                            }
                          }}
                          title={`${hhmm} ${item.candidate.name} · ${ROUND_LABEL[item.round]} · ${item.candidate.position?.title ?? "未知岗位"} · ${item.interviewer ?? "未分配面试官"}`}
                          className={cn(
                            "group flex w-full cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] leading-4 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200",
                            cell.inMonth ? "" : "opacity-60"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              ROUND_DOT_CLASS[item.round]
                            )}
                          />
                          <span className="shrink-0 font-semibold tabular-nums text-slate-500">
                            {hhmm}
                          </span>
                          <span className="flex min-w-0 items-baseline gap-1">
                            <span className="shrink-0 text-slate-700">
                              {item.candidate.name}
                            </span>
                            <span className="truncate text-slate-400">
                              {item.candidate.position?.title ?? "未知岗位"}
                            </span>
                          </span>
                          {!item.interviewer && (
                            <span
                              title="未分配面试官"
                              className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                            />
                          )}
                          <button
                            type="button"
                            aria-label={`修改${item.candidate.name}的面试时间`}
                            title="修改面试时间"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReschedule(item);
                            }}
                            className="ml-auto hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 group-hover:block"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setDayModalKey(cell.key)}
                        className="rounded-md px-1 text-left text-[10px] font-medium text-emerald-600 transition hover:bg-emerald-50"
                      >
                        +{hiddenCount} 场 · 查看全部
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 日历「+N 场」当日全部面试清单 */}
      <Modal
        open={!!dayModalKey}
        onClose={() => setDayModalKey(null)}
        title={
          dayModalKey
            ? (() => {
                const d = parseDateKey(dayModalKey);
                const diff = Math.round(
                  (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
                    startOfToday().getTime()) /
                    86_400_000
                );
                const label = dayLabel(diff);
                return `${d.getMonth() + 1} 月 ${d.getDate()} 日${
                  label ? ` ${label}` : ""
                } ${WEEKDAYS[d.getDay()]}`;
              })()
            : ""
        }
        description={dayModalItems.length ? `共 ${dayModalItems.length} 场面试` : undefined}
        className="max-w-md"
      >
        <div className="space-y-2">
          {dayModalItems.map((item) => (
            <ScheduleRow
              key={`${item.candidate.id}-${item.round}`}
              item={item}
              onClick={() => openCandidate(item.candidate.id)}
              onReschedule={() => {
                setDayModalKey(null);
                openReschedule(item);
              }}
            />
          ))}
        </div>
      </Modal>

      {/* 修改面试时间 */}
      <Modal
        open={!!rescheduleItem}
        onClose={() => (rescheduleSaving ? null : setRescheduleItem(null))}
        title={
          rescheduleItem
            ? `${rescheduleItem.time ? "修改" : "确认"}${
                ROUND_LABEL[rescheduleItem.round]
              }时间`
            : ""
        }
        description={
          rescheduleItem
            ? `${rescheduleItem.candidate.name} · ${
                rescheduleItem.candidate.position?.title ?? "未知岗位"
              }`
            : undefined
        }
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">
              {rescheduleItem?.time ? "新的面试时间" : "面试时间"}
            </Label>
            <div className="relative">
              <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="datetime-local"
                value={rescheduleValue}
                onChange={(e) => {
                  setRescheduleValue(e.target.value);
                  setRescheduleError(null);
                }}
                className="flex h-10 w-full rounded-xl border border-input bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {rescheduleError && (
              <p className="mt-1.5 text-xs text-destructive">
                {rescheduleError}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={rescheduleSaving}
              onClick={() => setRescheduleItem(null)}
            >
              取消
            </Button>
            <Button onClick={confirmReschedule} loading={rescheduleSaving}>
              确认修改
            </Button>
          </div>
        </div>
      </Modal>

      <InterviewerManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        interviewers={interviewers}
      />
    </div>
  );
}

/** 列表与当日弹窗共用的单场面试卡片 */
function ScheduleRow({
  item,
  onClick,
  onReschedule,
}: {
  item: ScheduleItem;
  onClick: () => void;
  onReschedule: () => void;
}) {
  const tentative = !item.time;
  const t = item.time ? new Date(item.time) : null;
  const hh = t ? pad2(t.getHours()) : "--";
  const mm = t ? pad2(t.getMinutes()) : "--";
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
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border bg-white px-4 py-3.5 text-left card-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200",
        tentative
          ? "border-amber-200 hover:border-amber-300 hover:shadow-md"
          : "border-slate-100 hover:border-emerald-200 hover:shadow-md"
      )}
    >
      {/* 时间块：暂定显示琥珀色时钟图标 */}
      {tentative ? (
        <div className="flex w-12 shrink-0 flex-col items-center justify-center self-stretch rounded-xl bg-amber-100 py-1.5">
          <CalendarClock className="h-4 w-4 text-amber-600" />
        </div>
      ) : (
        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-1.5">
          <span className="text-base font-bold leading-tight text-slate-800">
            {hh}:{mm}
          </span>
        </div>
      )}
      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {item.candidate.name}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              ROUND_CHIP_CLASS[item.round]
            )}
          >
            {ROUND_LABEL[item.round]}
          </span>
          {tentative && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
              时间暂定
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          应聘岗位：{item.candidate.position?.title ?? "—"}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs">
          <UserCog className="h-3 w-3 shrink-0 text-slate-400" />
          {item.interviewer ? (
            <span className="truncate font-medium text-slate-600">
              面试官：{item.interviewer}
            </span>
          ) : (
            <span className="truncate text-amber-500">未分配面试官</span>
          )}
        </p>
      </div>
      <button
        type="button"
        aria-label={`${tentative ? "确认" : "修改"}${item.candidate.name}的面试时间`}
        title={tentative ? "确认面试时间" : "修改面试时间"}
        onClick={(e) => {
          e.stopPropagation();
          onReschedule();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition",
          tentative
            ? "border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
        )}
      >
        <Pencil className="h-3 w-3" />
        {tentative ? "定时间" : "改期"}
      </button>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-emerald-500 text-white shadow-sm"
          : "text-muted-foreground hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
