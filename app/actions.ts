"use server";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";
import { MAX_RESUME_SIZE, ROUND_DONE_STATUS } from "@/lib/constants";
import { formatInterviewTimeBeijing } from "@/lib/utils";
import { CANDIDATE_STATUSES, type CandidateStatus } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface LoginState {
  error?: string;
}

async function requireSession() {
  const cookieStore = await cookies();
  const valid = await verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value
  );
  if (!valid) redirect("/login");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 记录一条状态流转日志 */
async function writeLog(params: {
  candidateId: string;
  fromStatus: string | null;
  toStatus: string;
  note?: string | null;
  operatorName?: string | null;
}) {
  const sb = getSupabase();
  await sb.from("candidate_status_logs").insert({
    candidate_id: params.candidateId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    note: params.note ?? null,
    operator_name: params.operatorName ?? null,
  });
}

// ---------------------------------------------------------------------
// 认证
// ---------------------------------------------------------------------

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.SYSTEM_PASSWORD;
  if (!expected) {
    return { error: "服务端未配置 SYSTEM_PASSWORD，请联系管理员" };
  }
  if (!password || !safeEqual(password, expected)) {
    return { error: "密码不正确，请重试" };
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return {};
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------------
// 岗位
// ---------------------------------------------------------------------

export async function createPositionAction(
  title: string
): Promise<ActionResult> {
  await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "请填写岗位名称" };
  if (trimmed.length > 50)
    return { ok: false, error: "岗位名称不能超过 50 个字" };

  const sb = getSupabase();
  // 若同名岗位被停用，直接重新启用而不是报错
  const { data: existing } = await sb
    .from("positions")
    .select("id, status")
    .eq("title", trimmed)
    .maybeSingle();

  if (existing) {
    if (existing.status === "closed") {
      const { error } = await sb
        .from("positions")
        .update({ status: "active" })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/");
      return { ok: true };
    }
    return { ok: false, error: "该岗位已存在" };
  }

  const { error } = await sb.from("positions").insert({ title: trimmed });
  if (error) {
    if (error.message.includes("duplicate") || /unique/i.test(error.message)) {
      return { ok: false, error: "该岗位已存在" };
    }
    return { ok: false, error: `岗位创建失败：${error.message}` };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function setPositionStatusAction(
  positionId: string,
  status: "active" | "closed"
): Promise<ActionResult> {
  await requireSession();

  const sb = getSupabase();
  const { error } = await sb
    .from("positions")
    .update({ status })
    .eq("id", positionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------
// 面试官名册
// ---------------------------------------------------------------------

export async function createInterviewerAction(
  name: string
): Promise<ActionResult> {
  await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "请填写面试官姓名" };
  if (trimmed.length > 50)
    return { ok: false, error: "姓名不能超过 50 个字" };

  const sb = getSupabase();
  const { error } = await sb.from("interviewers").insert({ name: trimmed });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "该面试官已存在" };
    }
    return { ok: false, error: `添加失败：${error.message}` };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function deleteInterviewerAction(
  id: string
): Promise<ActionResult> {
  await requireSession();

  const sb = getSupabase();
  const { data: row, error: fetchError } = await sb
    .from("interviewers")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "面试官不存在" };

  // 占用校验：仍有“待进行”的面试指定该面试官时禁止删除
  const { data: used } = await sb
    .from("interviews")
    .select("scheduled_time, candidates!inner(status)")
    .eq("interviewer", row.name);

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  const pendingCount = (used ?? []).filter((i) => {
    const candidate = i.candidates as unknown as { status?: string } | null;
    const isPending =
      candidate?.status === "初试排期" ||
      candidate?.status === "复试排期";
    return (
      isPending &&
      i.scheduled_time &&
      new Date(i.scheduled_time).getTime() >= cutoff.getTime()
    );
  }).length;

  if (pendingCount > 0) {
    return {
      ok: false,
      error: `该面试官还有 ${pendingCount} 场待进行的面试，请先在候选人详情中改派面试官`,
    };
  }

  const { error } = await sb.from("interviewers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------
// 候选人
// ---------------------------------------------------------------------

export async function createCandidateAction(
  formData: FormData
): Promise<ActionResult> {
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const positionId = String(formData.get("position_id") ?? "");
  const resumeText = String(formData.get("resume_text") ?? "").trim();
  const file = formData.get("resume_file");

  if (!name) return { ok: false, error: "请填写候选人姓名" };
  if (!positionId) return { ok: false, error: "请选择应聘岗位" };

  // 校验岗位存在且处于招聘中（已停用岗位不可再录入）
  const sbCheck = getSupabase();
  const { data: position } = await sbCheck
    .from("positions")
    .select("id, status")
    .eq("id", positionId)
    .maybeSingle();
  if (!position) return { ok: false, error: "所选岗位不存在" };
  if (position.status === "closed")
    return { ok: false, error: "该岗位已停用，不能录入候选人" };

  let resumeUrl: string | null = null;
  if (file && file instanceof File && file.size > 0) {
    if (file.size > MAX_RESUME_SIZE) {
      return { ok: false, error: "简历文件不能超过 10MB" };
    }
    const sb = getSupabase();
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";
    const path = `${randomUUID()}${ext}`;
    const { error: uploadError } = await sb.storage
      .from("resumes")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) {
      return { ok: false, error: `简历上传失败：${uploadError.message}` };
    }
    resumeUrl = sb.storage.from("resumes").getPublicUrl(path).data.publicUrl;
  }

  if (!resumeUrl && !resumeText) {
    return { ok: false, error: "请上传简历文件或粘贴简历文本" };
  }

  const sb = getSupabase();
  const candidateId = randomUUID();
  const { error: insertError } = await sb.from("candidates").insert({
    id: candidateId,
    name,
    position_id: positionId,
    resume_url: resumeUrl,
    resume_text: resumeText || null,
    status: "待筛",
  });
  if (insertError) {
    return { ok: false, error: `候选人保存失败：${insertError.message}` };
  }

  await writeLog({
    candidateId,
    fromStatus: null,
    toStatus: "待筛",
    note: "录入简历",
  });

  revalidatePath("/");
  return { ok: true };
}

// 允许的状态流转白名单
const ALLOWED_ADVANCES: Record<string, CandidateStatus> = {
  待筛: "初试排期",
  初试完成: "复试排期",
  复试完成: "录用",
};

export async function advanceStatusAction(
  candidateId: string,
  toStatus: CandidateStatus,
  operatorName: string,
  /** 推进到初试/复试排期时必传的面试时间（ISO） */
  scheduledTime?: string | null,
  /** 面试官姓名 */
  interviewer?: string | null
): Promise<ActionResult> {
  await requireSession();

  const sb = getSupabase();
  const { data: candidate, error: fetchError } = await sb
    .from("candidates")
    .select("id, status")
    .eq("id", candidateId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!candidate) return { ok: false, error: "候选人不存在" };

  const fromStatus = candidate.status as CandidateStatus;
  let target: CandidateStatus;

  if (toStatus === "已淘汰") {
    if (fromStatus === "已淘汰" || fromStatus === "录用") {
      return { ok: false, error: "该候选人流程已结束" };
    }
    target = "已淘汰";
  } else {
    const allowed = ALLOWED_ADVANCES[fromStatus];
    if (allowed !== toStatus || !CANDIDATE_STATUSES.includes(toStatus)) {
      return { ok: false, error: "当前状态不允许该操作" };
    }
    target = toStatus;
  }

  // 进入初/复试排期时，强制要求面试时间
  const round: 1 | 2 | null =
    target === "初试排期" ? 1 : target === "复试排期" ? 2 : null;
  let scheduledIso: string | null = null;
  if (round) {
    if (!scheduledTime) {
      return {
        ok: false,
        error: `请先选择${round === 1 ? "初试" : "复试"}时间再推进`,
      };
    }
    const parsed = new Date(scheduledTime);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "面试时间格式不正确" };
    }
    scheduledIso = parsed.toISOString();
  }

  // 面试官姓名必须来自名册（未填则视为未分配）；
  // 例外：与该候选人本轮既有面试官同名（历史遗留姓名），允许原样保留
  const interviewerName = (interviewer ?? "").trim().slice(0, 50) || null;
  if (interviewerName) {
    let isLegacy = false;
    if (round) {
      const { data: legacy } = await sb
        .from("interviews")
        .select("interviewer")
        .eq("candidate_id", candidateId)
        .eq("round", round)
        .maybeSingle();
      isLegacy = legacy?.interviewer === interviewerName;
    }
    if (!isLegacy) {
      const { data: rosterRow } = await sb
        .from("interviewers")
        .select("id")
        .eq("name", interviewerName)
        .maybeSingle();
      if (!rosterRow) {
        return {
          ok: false,
          error: `面试官「${interviewerName}」不在名册中，请先在「面试日程表」中添加`,
        };
      }
    }
  }

  const { error: updateError } = await sb
    .from("candidates")
    .update({ status: target })
    .eq("id", candidateId);
  if (updateError) return { ok: false, error: updateError.message };

  // 进入初/复试排期时，创建对应面试记录并写入已确认的面试时间与面试官
  if (round) {
    const { data: existing } = await sb
      .from("interviews")
      .select("id, scheduled_time")
      .eq("candidate_id", candidateId)
      .eq("round", round)
      .maybeSingle();
    if (existing) {
      // 已有记录但缺时间（历史数据兼容），补上时间；面试官以本次排期为准
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (!existing.scheduled_time) patch.scheduled_time = scheduledIso;
      if (interviewerName) patch.interviewer = interviewerName;
      await sb.from("interviews").update(patch).eq("id", existing.id);
    } else {
      await sb.from("interviews").insert({
        candidate_id: candidateId,
        round,
        scheduled_time: scheduledIso,
        interviewer: interviewerName,
      });
    }
  }

  const noteMap: Partial<Record<CandidateStatus, string>> = {
    初试排期: "安排初试",
    复试排期: "安排复试",
    录用: "确认录用",
    已淘汰: "淘汰候选人",
  };

  let note = noteMap[target] ?? null;
  // 按北京时间展示，避免服务器 UTC 时区导致备注时间偏移
  const localTimeText = formatInterviewTimeBeijing(scheduledIso);
  if (round && localTimeText) {
    note = `${note ?? "安排面试"} · ${localTimeText}`;
    if (interviewerName) note += ` · 面试官 ${interviewerName}`;
  }

  await writeLog({
    candidateId,
    fromStatus,
    toStatus: target,
    note,
    operatorName: operatorName.trim() || null,
  });

  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------
// 面试记录
// ---------------------------------------------------------------------

export async function saveInterviewAction(params: {
  candidateId: string;
  round: 1 | 2;
  scheduledTime: string | null;
  interviewer?: string;
  feedback: string;
  operatorName: string;
}): Promise<ActionResult> {
  await requireSession();

  const sb = getSupabase();
  const { data: candidate, error: fetchError } = await sb
    .from("candidates")
    .select("id, status")
    .eq("id", params.candidateId)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!candidate) return { ok: false, error: "候选人不存在" };

  const feedback = params.feedback.trim();
  const operatorName = params.operatorName.trim() || null;
  const fromStatus = candidate.status as CandidateStatus;

  // 排期状态下必须保留面试时间（日程表依赖）
  const schedulingStatus: CandidateStatus =
    params.round === 1 ? "初试排期" : "复试排期";
  const doneStatus = ROUND_DONE_STATUS[params.round];
  if (fromStatus === schedulingStatus && !params.scheduledTime) {
    return { ok: false, error: "请先选择面试时间" };
  }

  // upsert：每个候选人每轮仅一条记录
  const { data: existing } = await sb
    .from("interviews")
    .select("id")
    .eq("candidate_id", params.candidateId)
    .eq("round", params.round)
    .maybeSingle();

  const payload = {
    scheduled_time: params.scheduledTime,
    interviewer: (params.interviewer ?? "").trim().slice(0, 50) || null,
    feedback: feedback || null,
    operator_name: operatorName,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await sb
      .from("interviews")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb.from("interviews").insert({
      candidate_id: params.candidateId,
      round: params.round,
      ...payload,
    });
    if (error) return { ok: false, error: error.message };
  }

  // 填写了评价且当前处于对应“排期”状态 -> 推进到“完成”

  if (feedback && fromStatus === schedulingStatus) {
    const { error } = await sb
      .from("candidates")
      .update({ status: doneStatus })
      .eq("id", params.candidateId);
    if (error) return { ok: false, error: error.message };

    await writeLog({
      candidateId: params.candidateId,
      fromStatus,
      toStatus: doneStatus,
      note: (() => {
        const base = `提交${params.round === 1 ? "初试" : "复试"}评价`;
        const localText = formatInterviewTimeBeijing(params.scheduledTime);
        return localText ? `${base}（${localText}）` : base;
      })(),
      operatorName,
    });
  } else {
    await writeLog({
      candidateId: params.candidateId,
      fromStatus,
      toStatus: fromStatus,
      note: `更新${params.round === 1 ? "初试" : "复试"}安排`,
      operatorName,
    });
  }

  revalidatePath("/");
  return { ok: true };
}
