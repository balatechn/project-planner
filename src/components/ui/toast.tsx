"use client";

import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";
type Toast = { id: number; title: string; description?: string; variant: ToastVariant };

type ToastContextValue = {
  toast: (t: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback<ToastContextValue["toast"]>((t) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, variant: "default", ...t }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-fade-in flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg",
            )}
          >
            <div className="mt-0.5">
              {t.variant === "success" && (
                <CheckCircle2 className="h-5 w-5 text-accent" />
              )}
              {t.variant === "error" && (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {t.variant === "default" && (
                <Info className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
