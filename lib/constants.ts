import type { CandidateStatus } from "@/lib/types";

/** 看板分组：待筛 / 面试中 / 已结束 */
export const BOARD_COLUMNS: {
  key: string;
  title: string;
  statuses: CandidateStatus[];
  dotClass: string;
}[] = [
  {
    key: "screening",
    title: "待筛",
    statuses: ["待筛"],
    dotClass: "bg-slate-400",
  },
  {
    key: "interviewing",
    title: "面试中",
    statuses: ["初试排期", "初试完成", "复试排期", "复试完成"],
    dotClass: "bg-blue-500",
  },
  {
    key: "closed",
    title: "已结束",
    statuses: ["已淘汰", "录用"],
    dotClass: "bg-emerald-500",
  },
];

/** 候选人卡片/详情上的状态徽标配色 */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "待筛":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "初试排期":
    case "复试排期":
      return "bg-blue-50 text-blue-600 ring-blue-100";
    case "初试完成":
    case "复试完成":
      return "bg-violet-50 text-violet-600 ring-violet-100";
    case "已淘汰":
      return "bg-rose-50 text-rose-500 ring-rose-100";
    case "录用":
      return "bg-emerald-50 text-emerald-600 ring-emerald-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

/** 允许的状态流转：当前状态 -> 可推进到的状态 */
export function nextStatus(status: CandidateStatus): {
  to: CandidateStatus;
  label: string;
  variant: "primary" | "success";
} | null {
  switch (status) {
    case "待筛":
      return { to: "初试排期", label: "推进到初试", variant: "primary" };
    case "初试完成":
      return { to: "复试排期", label: "推进到复试", variant: "primary" };
    case "复试完成":
      return { to: "录用", label: "录用", variant: "success" };
    default:
      return null;
  }
}

export const TERMINAL_STATUSES: CandidateStatus[] = ["已淘汰", "录用"];

export const ROUND_LABEL: Record<1 | 2, string> = {
  1: "初试",
  2: "复试",
};

/** 提交某轮面试评价后进入的“已完成”状态 */
export const ROUND_DONE_STATUS: Record<1 | 2, CandidateStatus> = {
  1: "初试完成",
  2: "复试完成",
};

export const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10MB

export const RESUME_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt";
