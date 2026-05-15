import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends Required<ToastInput> {
  id: string;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const toneMap: Record<ToastVariant, string> = {
  success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  error: 'border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300',
  info: 'border-blue-500/35 bg-blue-500/10 text-blue-600 dark:text-blue-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    const item: ToastItem = {
      id,
      title: toast.title,
      description: toast.description || '',
      variant: toast.variant || 'info',
    };
    setToasts((items) => [item, ...items].slice(0, 4));
    window.setTimeout(() => dismiss(id), toast.variant === 'error' ? 6500 : 4200);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = iconMap[toast.variant] || AlertCircle;
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto rounded-md border bg-card p-3 text-card-foreground shadow-2xl',
                'animate-in slide-in-from-right-3 fade-in duration-200',
              )}
            >
              <div className="flex gap-3">
                <div className={cn('mt-0.5 rounded p-1', toneMap[toast.variant])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
