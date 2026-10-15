"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCandidateAction } from "@/app/actions";
import { MAX_RESUME_SIZE, RESUME_ACCEPT } from "@/lib/constants";
import type { Position } from "@/lib/types";

interface AddCandidateDialogProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

export function AddCandidateDialog({
  open,
  onClose,
  positions,
}: AddCandidateDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [positionId, setPositionId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setName("");
    setPositionId("");
    setResumeText("");
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (pending) return;
    resetForm();
    onClose();
  }

  function handleFileChange(f: File | null) {
    if (f && f.size > MAX_RESUME_SIZE) {
      setError("简历文件不能超过 10MB");
      return;
    }
    setFile(f);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) return setError("请填写候选人姓名");
    if (!positionId) return setError("请选择应聘岗位");
    if (!file && !resumeText.trim())
      return setError("请上传简历文件，或粘贴简历文本（二者至少填一项）");

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("position_id", positionId);
    formData.set("resume_text", resumeText);
    if (file) formData.set("resume_file", file);

    setPending(true);
    const result = await createCandidateAction(formData);
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "提交失败，请重试");
      return;
    }
    resetForm();
    onClose();
    router.refresh();
  }

  // 已停用岗位不出现在录入下拉中（历史候选人的岗位名走 join，不受影响）
  const activePositions = positions.filter((p) => p.status === "active");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="录入简历"
      description="提交后候选人将进入「待筛」状态"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="candidate-name">
              候选人姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="candidate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：张三"
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="candidate-position">
              应聘岗位 <span className="text-destructive">*</span>
            </Label>
            <select
              id="candidate-position"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/15"
            >
              <option value="">请选择岗位</option>
              {activePositions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>上传简历文件</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept={RESUME_ACCEPT}
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate text-emerald-700">{file.name}</span>
                <span className="shrink-0 text-xs text-emerald-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleFileChange(null)}
                className="rounded-lg p-1 text-emerald-600 transition hover:bg-emerald-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-3 py-7 text-sm text-muted-foreground transition hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-600"
            >
              <Paperclip className="h-6 w-6" />
              <span className="font-medium">点击选择简历文件</span>
              <span className="text-xs">
                支持 PDF / Word / 图片 / TXT，10MB 以内
              </span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resume-text">或粘贴简历文本</Label>
          <Textarea
            id="resume-text"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="可直接粘贴简历文字内容…"
            rows={6}
            className="resize-y"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={pending}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            提交并进入待筛
          </Button>
        </div>
      </div>
    </Modal>
  );
}
