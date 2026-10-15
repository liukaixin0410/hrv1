"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Plus, Power } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createPositionAction,
  setPositionStatusAction,
} from "@/app/actions";
import type { Position } from "@/lib/types";

interface PositionManageDialogProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

export function PositionManageDialog({
  open,
  onClose,
  positions,
}: PositionManageDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function handleClose() {
    if (adding || togglingId) return;
    setTitle("");
    setError(null);
    onClose();
  }

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("请填写岗位名称");
      return;
    }
    setAdding(true);
    setError(null);
    const result = await createPositionAction(trimmed);
    setAdding(false);
    if (!result.ok) {
      setError(result.error ?? "创建失败");
      return;
    }
    setTitle("");
    router.refresh();
  }

  async function handleToggle(p: Position) {
    const next = p.status === "active" ? "closed" : "active";
    if (
      next === "closed" &&
      !window.confirm(`确认停用「${p.title}」？停用后该岗位不能再录入新候选人，历史数据不受影响。`)
    ) {
      return;
    }
    setTogglingId(p.id);
    const result = await setPositionStatusAction(p.id, next);
    setTogglingId(null);
    if (!result.ok) {
      setError(result.error ?? "操作失败");
      return;
    }
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="岗位管理"
      description="新增岗位即刻出现在所有筛选器中；停用后不可再录入简历"
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* 新增岗位 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="输入新岗位名称，如：新媒体运营"
              maxLength={50}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAdd} loading={adding} className="shrink-0">
            <Plus className="h-4 w-4" />
            新增
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* 岗位列表 */}
        <div className="max-h-72 space-y-1.5 overflow-y-auto thin-scrollbar pr-1">
          {positions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无岗位，请在上方新增
            </p>
          )}
          {positions.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {p.title}
                </span>
                {p.status === "closed" && (
                  <Badge className="bg-slate-100 text-slate-500 ring-slate-200">
                    已停用
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggle(p)}
                disabled={togglingId === p.id}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  p.status === "active"
                    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    : "text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {p.status === "active" ? "停用" : "启用"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
