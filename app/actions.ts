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
  operatorName: string
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

  const { error: updateError } = await sb
    .from("candidates")
    .update({ status: target })
    .eq("id", candidateId);
  if (updateError) return { ok: false, error: updateError.message };

  // 进入初/复试排期时，确保对应的面试记录存在
  const round: 1 | 2 | null =
    target === "初试排期" ? 1 : target === "复试排期" ? 2 : null;
  if (round) {
    const { data: existing } = await sb
      .from("interviews")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("round", round)
      .maybeSingle();
    if (!existing) {
      await sb.from("interviews").insert({
        candidate_id: candidateId,
        round,
      });
    }
  }

  const noteMap: Partial<Record<CandidateStatus, string>> = {
    初试排期: "安排初试",
    复试排期: "安排复试",
    录用: "确认录用",
    已淘汰: "淘汰候选人",
  };

  await writeLog({
    candidateId,
    fromStatus,
    toStatus: target,
    note: noteMap[target] ?? null,
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

  // upsert：每个候选人每轮仅一条记录
  const { data: existing } = await sb
    .from("interviews")
    .select("id")
    .eq("candidate_id", params.candidateId)
    .eq("round", params.round)
    .maybeSingle();

  const payload = {
    scheduled_time: params.scheduledTime,
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
  const schedulingStatus: CandidateStatus =
    params.round === 1 ? "初试排期" : "复试排期";
  const doneStatus = ROUND_DONE_STATUS[params.round];

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
      note: params.scheduledTime
        ? `提交${params.round === 1 ? "初试" : "复试"}评价（${new Date(
            params.scheduledTime
          ).toLocaleString("zh-CN", { hour12: false })}）`
        : `提交${params.round === 1 ? "初试" : "复试"}评价`,
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
