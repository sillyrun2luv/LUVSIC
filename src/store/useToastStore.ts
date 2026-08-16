import { create } from "zustand";
import { t } from "@/store/useI18nStore";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  tone: "default" | "success" | "warn";
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastItem["tone"], action?: ToastAction) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "default", action) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone, action }] }));
    // 带操作按钮的 toast 留 5 秒，普通 toast 留 2.6 秒
    const duration = action ? 5000 : 2600;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(
  message: string,
  tone: ToastItem["tone"] = "default",
  action?: ToastAction,
) {
  useToastStore.getState().push(message, tone, action);
}
