export type ToastTone = 'error' | 'info' | 'success';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export function createToast(message: string, tone: ToastTone = 'info', now: () => number = Date.now): ToastMessage {
  return {
    id: now(),
    message,
    tone,
  };
}
