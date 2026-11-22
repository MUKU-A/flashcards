import { signal } from '@preact/signals';

type Toast = { id: number; message: string; actionLabel?: string; action?: () => void };
export const toast = signal<Toast | null>(null);
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, actionLabel?: string, action?: () => void) {
  clearTimeout(timer);
  const id = ++seq;
  toast.value = { id, message, actionLabel, action };
  timer = setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, action ? 5000 : 2500);
}

export function ToastView() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status">
      <span>{t.message}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action!();
            toast.value = null;
          }}
        >
          {t.actionLabel}
        </button>
      )}
    </div>
  );
}
