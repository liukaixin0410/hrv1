export const CANDIDATE_STATUSES = [
  "待筛",
  "初试排期",
  "初试完成",
  "复试排期",
  "复试完成",
  "面试不通过",
  "面试通过",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface Position {
  id: string;
  title: string;
  /** active=招聘中, closed=已停用（停用后不可再录入，但历史数据保留） */
  status: "active" | "closed";
  created_at: string;
}

export interface Interviewer {
  id: string;
  name: string;
  created_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  round: 1 | 2;
  scheduled_time: string | null;
  /** 面试官姓名（自由填写，用于日程展示与筛选） */
  interviewer: string | null;
  feedback: string | null;
  operator_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusLog {
  id: string;
  candidate_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  operator_name: string | null;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  resume_url: string | null;
  resume_text: string | null;
  position_id: string;
  status: CandidateStatus;
  created_at: string;
  position?: Position;
  interviews?: Interview[];
  status_logs?: StatusLog[];
}
