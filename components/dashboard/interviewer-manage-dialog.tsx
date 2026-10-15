"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCog, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createInterviewerAction,
  deleteInterviewerAction,
} from "@/app/actions";
import type { Interviewer } from "@/lib/types";

interface InterviewerManageDialogProps {
  open: boolean;
  onClose: () => void;
  interviewers: Interviewer[];
}

export function InterviewerManageDialog({
  open,
  onClose,
  interviewers,
}: InterviewerManageDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleClose() {
    if (adding || deletingId) return;
    setName("");
    setError(null);
    onClose();
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写面试官姓名");
      return;
    }
    setAdding(true);
    setError(null);
    const result = await createInterviewerAction(trimmed);
    setAdding(false);
    if (!result.ok) {
      setError(result.error ?? "添加失败");
      return;
    }
    setName("");
    router.refresh();
  }

  async function handleDelete(p: Interviewer) {
    if (
      !window.confirm(
        `确认删除面试官「${p.name}」？\n历史面试记录中的姓名会保留，但将无法再安排 TA 参加新面试。`
      )
    ) {
      return;
    }
    setDeletingId(p.id);
    const result = await deleteInterviewerAction(p.id);
    setDeletingId(null);
    if (!result.ok) {
      setError(result.error ?? "删除失败");
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="面试官管理"
      description="新增后可在排期时直接选择；有待进行面试的面试官需先改派才能删除"
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* 新增面试官 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="输入面试官姓名"
              maxLength={50}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAdd} loading={adding} className="shrink-0">
            <UserPlus className="h-4 w-4" />
            添加
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* 面试官列表 */}
        <div className="max-h-72 space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
          {interviewers.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无面试官，请在上方添加
            </p>
          )}
          {interviewers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-600">
                  {p.name.slice(0, 1)}
                </span>
                <span className="truncate text-sm font-medium">{p.name}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p)}
                disabled={deletingId === p.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
