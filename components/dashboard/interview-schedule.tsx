"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  Filter,
  Inbox,
  Settings2,
  UserCog,
} from "lucide-react";
import type { Candidate, Interviewer, Position } from "@/lib/types";
import { ROUND_CHIP_CLASS, ROUND_LABEL } from "@/lib/constants";
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 与“今天 0 点”的天数差：今天=0，明天=1 */
function dayDiff(iso: string): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t = startOfToday().getTime();
  return Math.round((a - t) / 86_400_000);
}

function dayLabel(diff: number): string {
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  return "";
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function groupKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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
      .filter((c) => !positionId || positionId === "all" || c.position_id === positionId)
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
      .sort(
        (a, b) =>
          new Date(a.time).getTime() - new Date(b.time).getTime()
      );
  }, [candidates, positionId, interviewerFilter]);

  // 按天分组（已按时间升序）
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = groupKey(item.time);
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return Array.from(map.entries());
  }, [items]);

  const todayCount = items.filter((i) => dayDiff(i.time) === 0).length;

  return (
    <div className="space-y-4">
      {/* 过滤栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          展示今天及以后待进行的面试，按时间升序排列
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
              ...interviewerOptions.map((name) => ({
                value: name,
                label: name,
              })),
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

      {groups.length === 0 ? (
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
        <div className="space-y-5">
          {groups.map(([key, dayItems]) => {
            const diff = dayDiff(dayItems[0].time);
            const d = new Date(dayItems[0].time);
            return (
              <div key={key}>
                {/* 日期分组头 */}
                <div className="mb-2 flex items-center gap-2">
                  <CalendarClock
                    className={`h-4 w-4 ${
                      diff <= 1 ? "text-emerald-500" : "text-slate-400"
                    }`}
                  />
                  <h3 className="text-sm font-semibold">
                    {dayLabel(diff) ??
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
                  {dayItems.map((item) => {
                    const t = new Date(item.time);
                    const hh = String(t.getHours()).padStart(2, "0");
                    const mm = String(t.getMinutes()).padStart(2, "0");
                    return (
                      <button
                        key={`${item.candidate.id}-${item.round}`}
                        type="button"
                        onClick={() => onSelect(item.candidate.id)}
                        className="group flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left card-soft transition hover:border-emerald-200 hover:shadow-md"
                      >
                        {/* 时间块 */}
                        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-1.5">
                          <span className="text-base font-bold leading-tight text-slate-800">
                            {hh}:{mm}
                          </span>
                        </div>
                        {/* 信息 */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {item.candidate.name}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ROUND_CHIP_CLASS[item.round]}`}
                            >
                              {ROUND_LABEL[item.round]}
                            </span>
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
                              <span className="truncate text-amber-500">
                                未分配面试官
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
