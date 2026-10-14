"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/** 右侧滑出抽屉 */
export function Sheet({ open, onClose, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l bg-card shadow-2xl animate-slide-in-right",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="关闭详情"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
