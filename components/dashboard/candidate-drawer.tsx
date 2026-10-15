"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  History,
  UserCog,
  UserRound,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { InterviewCard } from "./interview-card";
import { Timeline } from "./timeline";
import { advanceStatusAction } from "@/app/actions";
import {
  TERMINAL_STATUSES,
  nextStatus,
  statusBadgeClass,
} from "@/lib/constants";
import {
  formatDateTime,
  resumeKind,
  toLocalInputValue,
} from "@/lib/utils";
import {
  CANDIDATE_STATUSES,
  type Candidate,
  type CandidateStatus,
} from "@/lib/types";

/** 默认面试时间：明天上午 10:00（本地时区，datetime-local 值） */
function defaultScheduleTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CandidateDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
  operatorName: string;
  onOperatorChange: (v: string) => void;
  /** 面试官名册姓名 */
  interviewerNames?: string[];
}

export function CandidateDrawer({
  candidate,
  onClose,
  operatorName,
  onOperatorChange,
  interviewerNames = [],
}: CandidateDrawerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<CandidateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 推进到初/复试时的强制排期弹窗
  const [scheduleTarget, setScheduleTarget] = useState<{
    to: CandidateStatus;
    round: 1 | 2;
  } | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleInterviewer, setScheduleInterviewer] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const interviewMap = useMemo(() => {
    const map = new Map<number, NonNullable<Candidate["interviews"]>[number]>();
    candidate?.interviews?.forEach((i) => map.set(i.round, i));
    return map;
  }, [candidate]);

  if (!candidate) {
    return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  }

  const statusIdx = CANDIDATE_STATUSES.indexOf(candidate.status);
  const showRound1 = statusIdx >= CANDIDATE_STATUSES.indexOf("初试排期");
  const showRound2 = statusIdx >= CANDIDATE_STATUSES.indexOf("复试排期");
  const isTerminal = TERMINAL_STATUSES.includes(candidate.status);
  const next = nextStatus(candidate.status);

  function openAdvance(to: CandidateStatus) {
    if (to === "初试排期" || to === "复试排期") {
      const round: 1 | 2 = to === "初试排期" ? 1 : 2;
      // 默认带出已存的面试时间
      const existing = interviewMap.get(round);
      setScheduleTime(
        existing?.scheduled_time
          ? toLocalInputValue(existing.scheduled_time)
          : defaultScheduleTime()
      );
      // 默认带出已安排的面试官（历史值允许保留），否则留空=未分配
      setScheduleInterviewer(existing?.interviewer ?? "");
      setScheduleError(null);
      setScheduleTarget({ to, round });
    } else {
      void handleAdvance(to);
    }
  }

  async function confirmSchedule() {
    if (!scheduleTarget) return;
    if (!scheduleTime) {
      setScheduleError(
        `请选择${scheduleTarget.round === 1 ? "初试" : "复试"}时间`
      );
      return;
    }
    const iso = new Date(scheduleTime).toISOString();
    await handleAdvance(scheduleTarget.to, iso, scheduleInterviewer);
    setScheduleTarget(null);
    setScheduleTime("");
    setScheduleInterviewer("");
  }

  async function handleAdvance(
    to: CandidateStatus,
    scheduledTime?: string,
    interviewer?: string
  ) {
    if (!candidate) return;
    if (
      (to === "已淘汰" && !window.confirm(`确认淘汰「${candidate.name}」？`)) ||
      (to === "录用" && !window.confirm(`确认录用「${candidate.name}」？`))
    ) {
      return;
    }
    setBusy(to);
    setError(null);
    const result = await advanceStatusAction(
      candidate.id,
      to,
      operatorName,
      scheduledTime ?? null,
      interviewer ?? null
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? "操作失败");
      return;
    }
    onOperatorChange(operatorName.trim());
    router.refresh();
  }

  const kind = resumeKind(candidate.resume_url);

  // 与候选人卡片一致的彩色头像
  const AVATAR_GRADIENTS = [
    "from-emerald-400 to-emerald-600",
    "from-blue-400 to-blue-600",
    "from-violet-400 to-violet-600",
    "from-amber-400 to-orange-500",
    "from-rose-400 to-pink-600",
    "from-cyan-400 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < candidate.name.length; i++)
    hash = (hash * 31 + candidate.name.charCodeAt(i)) >>> 0;
  const gradient = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];

  return (
    <Sheet open={!!candidate} onClose={onClose}>
      {/* 顶部信息 */}
      <div className="bg-gradient-to-br from-emerald-50/60 via-white to-blue-50/40 px-6 pb-5 pt-6">
        <div className="flex items-start gap-4 pr-10">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-md ${gradient}`}
          >
            {candidate.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                {candidate.name}
              </h2>
              <Badge className={statusBadgeClass(candidate.status)}>
                {candidate.status}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              应聘岗位：{candidate.position?.title ?? "未知岗位"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <UserRound className="h-3 w-3" />
              {formatDateTime(candidate.created_at)} 录入
            </p>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="thin-scrollbar flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
          {/* 简历区 */}
          <section className="md:col-span-2">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              简历
            </h3>
            <div className="space-y-3">
              {candidate.resume_url && (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white card-soft">
                  {kind === "pdf" && (
                    <iframe
                      src={candidate.resume_url}
                      title="简历预览"
                      className="h-80 w-full bg-slate-50 md:h-[420px]"
                    />
                  )}
                  {kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.resume_url}
                      alt="简历图片"
                      className="max-h-[420px] w-full object-contain bg-slate-50"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2.5">
                    <span className="truncate text-xs text-muted-foreground">
                      {kind === "pdf"
                        ? "PDF 简历文件"
                        : kind === "image"
                          ? "简历图片"
                          : "简历附件"}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <a
                        href={candidate.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                      >
                        <ExternalLink className="h-3 w-3" />
                        打开
                      </a>
                      <a
                        href={candidate.resume_url}
                        download
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-slate-100"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {candidate.resume_text && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 card-soft">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                    {candidate.resume_text}
                  </p>
                </div>
              )}

              {!candidate.resume_url && !candidate.resume_text && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-muted-foreground">
                  未提供简历内容
                </div>
              )}
            </div>
          </section>

          {/* 流程与反馈区 */}
          <section className="space-y-4 md:col-span-3">
            <div>
              <h3 className="mb-2.5 text-sm font-semibold">流程操作</h3>
              {isTerminal ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-muted-foreground">
                  流程已结束（{candidate.status}）。面试记录仅供查看。
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {next && (
                    <Button
                      variant={next.variant === "success" ? "success" : "default"}
                      loading={busy === next.to}
                      onClick={() => openAdvance(next.to)}
                    >
                      {next.label}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    loading={busy === "已淘汰"}
                    onClick={() => handleAdvance("已淘汰")}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    淘汰
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    当前：{candidate.status}
                  </span>
                </div>
              )}
              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}
            </div>

            {showRound1 && (
              <InterviewCard
                candidateId={candidate.id}
                round={1}
                interview={interviewMap.get(1)}
                readOnly={isTerminal}
                operatorName={operatorName}
                onOperatorChange={onOperatorChange}
                interviewerNames={interviewerNames}
              />
            )}

            {showRound2 && (
              <InterviewCard
                candidateId={candidate.id}
                round={2}
                interview={interviewMap.get(2)}
                readOnly={isTerminal}
                operatorName={operatorName}
                onOperatorChange={onOperatorChange}
                interviewerNames={interviewerNames}
              />
            )}

            <div>
              <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-4 w-4 text-muted-foreground" />
                历史时间线
              </h3>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 card-soft">
                <Timeline logs={candidate.status_logs ?? []} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 推进初/复试时的强制排期弹窗 */}
      <Modal
        open={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        title={scheduleTarget?.round === 1 ? "安排初试时间" : "安排复试时间"}
        description="必须先确认面试时间，该时间将同步出现在「面试日程表」中"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">面试时间</Label>
            <div className="relative">
              <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => {
                  setScheduleTime(e.target.value);
                  setScheduleError(null);
                }}
                className="flex h-10 w-full rounded-xl border border-input bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {scheduleError && (
              <p className="mt-1.5 text-xs text-destructive">{scheduleError}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5">面试官</Label>
            <div className="relative">
              <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={scheduleInterviewer}
                onChange={(e) => setScheduleInterviewer(e.target.value)}
                className="flex h-10 w-full appearance-none rounded-xl border border-input bg-white pl-9 pr-9 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">未分配面试官</option>
                {interviewerNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {/* 历史值已不在名册时原样保留 */}
                {scheduleInterviewer &&
                  !interviewerNames.includes(scheduleInterviewer) && (
                    <option value={scheduleInterviewer}>
                      {scheduleInterviewer}（已删除）
                    </option>
                  )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setScheduleTarget(null)}
            >
              取消
            </Button>
            <Button
              onClick={confirmSchedule}
              loading={busy === scheduleTarget?.to}
            >
              确认排期并推进
            </Button>
          </div>
        </div>
      </Modal>
    </Sheet>
  );
}
