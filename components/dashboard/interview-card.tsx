"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, MessageSquareText, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveInterviewAction } from "@/app/actions";
import { ROUND_LABEL } from "@/lib/constants";
import { cn, formatDateTime, toLocalInputValue } from "@/lib/utils";
import type { Interview } from "@/lib/types";

interface InterviewCardProps {
  candidateId: string;
  round: 1 | 2;
  interview?: Interview;
  /** 流程已结束（面试通过/不通过）时只读 */
  readOnly: boolean;
  /** 本轮正是候选人当前所处的轮次：展示通过/不通过结论按钮 */
  active?: boolean;
  /** 不通过前的二次确认（由抽屉提供应用内弹窗），返回用户是否确认 */
  confirmFail?: () => Promise<boolean>;
  operatorName: string;
  onOperatorChange: (v: string) => void;
  /** 面试官名册姓名 */
  interviewerNames?: string[];
}

export function InterviewCard({
  candidateId,
  round,
  interview,
  readOnly,
  active = false,
  confirmFail,
  operatorName,
  onOperatorChange,
  interviewerNames = [],
}: InterviewCardProps) {
  const router = useRouter();
  const [scheduled, setScheduled] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [operator, setOperator] = useState(operatorName);
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"save" | "pass" | "fail" | null>(
    null
  );

  // 服务端数据刷新后同步表单
  useEffect(() => {
    setScheduled(toLocalInputValue(interview?.scheduled_time ?? null));
    setInterviewer(interview?.interviewer ?? "");
    setFeedback(interview?.feedback ?? "");
    setOperator(interview?.operator_name ?? operatorName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    interview?.id,
    interview?.scheduled_time,
    interview?.interviewer,
    interview?.feedback,
    interview?.operator_name,
  ]);

  async function submit(kind: "save" | "pass" | "fail") {
    setError(null);
    const iso = scheduled ? new Date(scheduled).toISOString() : null;
    if (scheduled && Number.isNaN(new Date(scheduled).getTime())) {
      setError("面试时间格式不正确");
      return;
    }
    // 给出通过/不通过结论前，必须先确认面试时间
    if (kind !== "save" && !scheduled) {
      setError("请先确认面试时间后再给出面试结论");
      return;
    }
    if (kind === "fail" && confirmFail) {
      const confirmed = await confirmFail();
      if (!confirmed) return;
    }
    setBusyKind(kind);
    try {
      const result = await saveInterviewAction({
        candidateId,
        round,
        scheduledTime: iso,
        interviewer,
        feedback,
        operatorName: operator,
        decision: kind === "save" ? undefined : kind,
      });
      if (!result.ok) {
        setError(result.error ?? "保存失败");
        return;
      }
      onOperatorChange(operator.trim());
      router.refresh();
    } catch {
      setError("网络异常，保存未成功，请检查连接后重试");
    } finally {
      setBusyKind(null);
    }
  }

  // 排期中但时间未定（时间暂定，初/复试同理）：允许先保存面试官，时间待确认
  const tentative = !readOnly && !interview?.scheduled_time;

  const accent = round === 1 ? "sky" : "blue";
  const accentMap = {
    sky: {
      dot: "bg-sky-500",
      chip: "bg-sky-50 text-sky-600",
      ring: "focus-visible:ring-sky-500/15",
    },
    blue: {
      dot: "bg-blue-500",
      chip: "bg-blue-50 text-blue-600",
      ring: "focus-visible:ring-blue-500/15",
    },
  } as const;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 card-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accentMap[accent].dot}`} />
          <h4 className="text-sm font-semibold">
            {ROUND_LABEL[round]}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              第{round}轮
            </span>
          </h4>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            tentative ? "bg-amber-50 text-amber-600" : accentMap[accent].chip
          )}
        >
          {interview?.scheduled_time
            ? formatDateTime(interview.scheduled_time)
            : tentative
              ? "时间暂定（待确认）"
              : "未安排时间"}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`round-${round}-time`} className="text-xs">
            面试时间
          </Label>
          <div className="relative">
            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id={`round-${round}-time`}
              type="datetime-local"
              value={scheduled}
              disabled={readOnly}
              onChange={(e) => setScheduled(e.target.value)}
              className={`h-9 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 ${accentMap[accent].ring} disabled:bg-muted/50`}
            />
          </div>
          {tentative && (
            <p className="text-xs leading-5 text-amber-600">
              时间暂定中：选择时间后点底部保存即完成确认，将同步到「面试日程表」。
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`round-${round}-interviewer`} className="text-xs">
            面试官
          </Label>
          <div className="relative">
            <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id={`round-${round}-interviewer`}
              value={interviewer}
              disabled={readOnly}
              onChange={(e) => setInterviewer(e.target.value)}
              className={`h-9 w-full appearance-none rounded-lg border border-input bg-white pl-9 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 ${accentMap[accent].ring} disabled:bg-muted/50`}
            >
              <option value="">未分配面试官</option>
              {interviewerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {/* 历史值已不在名册时原样保留，避免保存评价时被意外覆盖 */}
              {interviewer && !interviewerNames.includes(interviewer) && (
                <option value={interviewer}>{interviewer}（已删除）</option>
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`round-${round}-feedback`} className="text-xs">
            面试评价
          </Label>
          <Textarea
            id={`round-${round}-feedback`}
            value={feedback}
            disabled={readOnly}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={`填写${ROUND_LABEL[round]}评价（可选）；点「通过」${round === 1 ? "自动进入复试" : "即录用通过"}，点「不通过」结束流程`}
            rows={4}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`round-${round}-operator`} className="text-xs">
            操作人签名
          </Label>
          <div className="relative">
            <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id={`round-${round}-operator`}
              value={operator}
              disabled={readOnly}
              onChange={(e) => setOperator(e.target.value)}
              onBlur={() => onOperatorChange(operator.trim())}
              placeholder="你的姓名"
              className={`h-9 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 ${accentMap[accent].ring} disabled:bg-muted/50`}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!readOnly &&
          (active ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={busyKind !== null}
                loading={busyKind === "save"}
                onClick={() => void submit("save")}
              >
                暂存
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={busyKind !== null}
                loading={busyKind === "fail"}
                onClick={() => void submit("fail")}
              >
                <X className="h-4 w-4" />
                不通过
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={busyKind !== null}
                loading={busyKind === "pass"}
                onClick={() => void submit("pass")}
              >
                <Check className="h-4 w-4" />
                {round === 1 ? "通过，进入复试" : "面试通过"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={busyKind !== null}
                loading={busyKind === "save"}
                onClick={() => void submit("save")}
              >
                保存{ROUND_LABEL[round]}记录
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}
