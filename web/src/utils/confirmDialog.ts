export type ConfirmTone = 'danger' | 'default';

export interface ConfirmRequest {
  id: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  onConfirm: () => void;
}

interface CreateConfirmRequestInput {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
}

export function createConfirmRequest(input: CreateConfirmRequestInput): ConfirmRequest {
  return {
    id: `confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: input.title,
    message: input.message,
    confirmLabel: input.confirmLabel,
    cancelLabel: input.cancelLabel ?? '取消',
    tone: input.tone ?? 'danger',
    onConfirm: input.onConfirm,
  };
}
