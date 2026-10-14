"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "hr_operator_name";

/** 操作人签名：记录在 localStorage，避免每次重复输入 */
export function useOperatorName() {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  const save = (value: string) => {
    setName(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  return [name, save] as const;
}
