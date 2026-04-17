import { atom } from "nanostores";

export type ToastKind = "success" | "error" | "info" | "warning";

export type ToastT = {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
};

export const toasts = atom<ToastT[]>([]);

const DEFAULT_TTL_MS = 4000;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pushToast(kind: ToastKind, message: string, ttlMs = DEFAULT_TTL_MS): string {
  const id = uid();
  const t: ToastT = { id, kind, message, createdAt: Date.now() };
  toasts.set([...toasts.get(), t]);
  if (ttlMs > 0) {
    setTimeout(() => dismissToast(id), ttlMs);
  }
  return id;
}

export function dismissToast(id: string): void {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}

export function clearToasts(): void {
  toasts.set([]);
}

export const toast = {
  success: (m: string, ttl?: number) => pushToast("success", m, ttl),
  error: (m: string, ttl?: number) => pushToast("error", m, ttl),
  info: (m: string, ttl?: number) => pushToast("info", m, ttl),
  warning: (m: string, ttl?: number) => pushToast("warning", m, ttl),
  dismiss: dismissToast,
};
