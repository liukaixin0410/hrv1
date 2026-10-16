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
import { MAX_RESUME_SIZE } from "@/lib/constants";
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
  复试完成: "面试通过",
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

  if (toStatus === "面试不通过") {
    if (fromStatus === "面试不通过" || fromStatus === "面试通过") {
      return { ok: false, error: "该候选人流程已结束" };
    }
    target = "面试不通过";
  } else {
    const allowed = ALLOWED_ADVANCES[fromStatus];
    if (allowed !== toStatus || !CANDIDATE_STATUSES.includes(toStatus)) {
      return { ok: false, error: "当前状态不允许该操作" };
    }
    target = toStatus;
  }

  // 进入初/复试排期时：时间与面试官均可先留空
  // （场景：需要先推进到下一轮、时间还需与面试官商议，稍后在看板/日程表补录）
  const round: 1 | 2 | null =
    target === "初试排期" ? 1 : target === "复试排期" ? 2 : null;
  let scheduledIso: string | null = null;
  if (round) {
    if (scheduledTime) {
      const parsed = new Date(scheduledTime);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: "面试时间格式不正确" };
      }
      scheduledIso = parsed.toISOString();
    }
    // 未传时间：本轮暂定，scheduledIso 保持 null
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
    面试通过: "确认面试通过",
    面试不通过: "标记为不通过",
  };

  let note = noteMap[target] ?? null;
  if (round) {
    // 按北京时间展示，避免服务器 UTC 时区导致备注时间偏移
    const localTimeText = formatInterviewTimeBeijing(scheduledIso);
    if (localTimeText) {
      note = `${note ?? "安排面试"} · ${localTimeText}`;
    } else {
      note = `${note ?? "安排面试"} · 时间暂定（待确认）`;
    }
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
// 删除候选人（简历传错等场景）
// ---------------------------------------------------------------------

/** 从 Storage 公开 URL 中解析 resumes 桶内对象路径 */
function resumePathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/resumes/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  } catch {
    return null;
  }
}

export async function deleteCandidateAction(
  candidateId: string,
  operatorName: string
): Promise<ActionResult> {
  await requireSession();

  try {
    const sb = getSupabase();
    const { data: candidate, error: fetchError } = await sb
      .from("candidates")
      .select("id, name, resume_url")
      .eq("id", candidateId)
      .maybeSingle();
    if (fetchError) return { ok: false, error: fetchError.message };
    if (!candidate) return { ok: false, error: "候选人不存在" };

    // 先删除 Storage 中的简历文件，失败则中止（避免产生无法追踪的孤儿文件）
    if (candidate.resume_url) {
      const path = resumePathFromUrl(candidate.resume_url);
      if (path) {
        const { error: storageError } = await sb.storage
          .from("resumes")
          .remove([path]);
        if (storageError) {
          return {
            ok: false,
            error: `简历文件删除失败：${storageError.message}`,
          };
        }
      }
    }

    // interviews / candidate_status_logs 均为 on delete cascade
    const { error: delError } = await sb
      .from("candidates")
      .delete()
      .eq("id", candidateId);
    if (delError) return { ok: false, error: delError.message };

    console.info(
      `[deleteCandidate] ${operatorName.trim() || "未知操作人"} 删除候选人 ${candidate.name}（${candidateId}）`
    );

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "删除失败，请稍后重试",
    };
  }
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
  /** 本轮结论：pass=通过（自动进入下一轮/面试通过），fail=不通过（流程结束）；不传=仅暂存 */
  decision?: "pass" | "fail";
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

  // 排期状态下的时间校验（初/复试规则一致）：
  // - 时间暂定时允许只保存面试官等信息；
  // - 给出通过/不通过结论、或提交评价前，必须先确认面试时间
  const schedulingStatus: CandidateStatus =
    params.round === 1 ? "初试排期" : "复试排期";
  const isActiveRound = fromStatus === schedulingStatus;

  if (params.decision && !isActiveRound) {
    return { ok: false, error: "当前状态不允许该操作" };
  }
  if (params.decision && !params.scheduledTime) {
    return { ok: false, error: "请先确认面试时间后再给出面试结论" };
  }
  if (!params.decision && isActiveRound && !params.scheduledTime && feedback) {
    return { ok: false, error: "请先确认面试时间后再提交评价" };
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

  const roundLabel = params.round === 1 ? "初试" : "复试";

  if (params.decision === "fail") {
    // 不通过：流程结束
    const { error } = await sb
      .from("candidates")
      .update({ status: "面试不通过" })
      .eq("id", params.candidateId);
    if (error) return { ok: false, error: error.message };

    await writeLog({
      candidateId: params.candidateId,
      fromStatus,
      toStatus: "面试不通过",
      note: `${roundLabel}不通过，流程结束`,
      operatorName,
    });
  } else if (params.decision === "pass") {
    if (params.round === 1) {
      // 初试通过：自动进入复试排期，并创建一条时间暂定的复试记录
      const { data: round2 } = await sb
        .from("interviews")
        .select("id")
        .eq("candidate_id", params.candidateId)
        .eq("round", 2)
        .maybeSingle();
      if (!round2) {
        const { error: insertError } = await sb.from("interviews").insert({
          candidate_id: params.candidateId,
          round: 2,
          scheduled_time: null,
        });
        if (insertError) return { ok: false, error: insertError.message };
      }
      const { error } = await sb
        .from("candidates")
        .update({ status: "复试排期" })
        .eq("id", params.candidateId);
      if (error) return { ok: false, error: error.message };

      await writeLog({
        candidateId: params.candidateId,
        fromStatus,
        toStatus: "复试排期",
        note: "初试通过，进入复试（时间待确认）",
        operatorName,
      });
    } else {
      // 复试通过：面试整体通过，流程结束
      const { error } = await sb
        .from("candidates")
        .update({ status: "面试通过" })
        .eq("id", params.candidateId);
      if (error) return { ok: false, error: error.message };

      await writeLog({
        candidateId: params.candidateId,
        fromStatus,
        toStatus: "面试通过",
        note: "复试通过，面试结束",
        operatorName,
      });
    }
  } else {
    // 未给结论：仅暂存本轮安排/评价，不改变状态
    await writeLog({
      candidateId: params.candidateId,
      fromStatus,
      toStatus: fromStatus,
      note: `更新${roundLabel}安排`,
      operatorName,
    });
  }

  revalidatePath("/");
  return { ok: true };
}

/**
 * 修改已安排的面试时间（改期）。
 * 仅允许候选人当前仍处于对应轮次的“排期”状态；评价/面试官等其它字段不动。
 */
export async function rescheduleInterviewAction(params: {
  candidateId: string;
  round: 1 | 2;
  scheduledTime: string;
  operatorName: string;
}): Promise<ActionResult> {
  await requireSession();

  const parsed = new Date(params.scheduledTime);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "面试时间格式不正确" };
  }
  const scheduledIso = parsed.toISOString();

  const sb = getSupabase();
  const { data: candidate, error: fetchError } = await sb
    .from("candidates")
    .select("id, name, status")
    .eq("id", params.candidateId)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!candidate) return { ok: false, error: "候选人不存在" };

  const schedulingStatus: CandidateStatus =
    params.round === 1 ? "初试排期" : "复试排期";
  if (candidate.status !== schedulingStatus) {
    return {
      ok: false,
      error: "该面试已不在待进行状态，不能修改时间",
    };
  }

  const { data: interview } = await sb
    .from("interviews")
    .select("id, scheduled_time")
    .eq("candidate_id", params.candidateId)
    .eq("round", params.round)
    .maybeSingle();
  if (!interview) return { ok: false, error: "面试记录不存在" };

  const { error: updError } = await sb
    .from("interviews")
    .update({
      scheduled_time: scheduledIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", interview.id);
  if (updError) return { ok: false, error: updError.message };

  const roundLabel = params.round === 1 ? "初试" : "复试";
  const oldText = formatInterviewTimeBeijing(interview.scheduled_time);
  const newText = formatInterviewTimeBeijing(scheduledIso);
  const note = oldText
    ? `调整${roundLabel}时间 · ${oldText} → ${newText}`
    : `确认${roundLabel}时间 · ${newText}`;

  await writeLog({
    candidateId: params.candidateId,
    fromStatus: candidate.status as CandidateStatus,
    toStatus: candidate.status as CandidateStatus,
    note,
    operatorName: params.operatorName.trim() || null,
  });

  revalidatePath("/");
  return { ok: true };
}
