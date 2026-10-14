import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "招聘与面试管理系统",
  description: "轻量级招聘流转工作台 · Phase 1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
