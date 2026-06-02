import { describe, expect, it } from 'vitest';
import { createConfirmRequest } from './confirmDialog';

describe('createConfirmRequest', () => {
  it('creates a confirmation request with message and destructive defaults', () => {
    const onConfirm = () => undefined;

    const request = createConfirmRequest({
      title: '确认删除药品规格？',
      message: '删除后关联追踪也会停用。',
      confirmLabel: '删除',
      onConfirm,
    });

    expect(request.id).toMatch(/^confirm-/);
    expect(request.title).toBe('确认删除药品规格？');
    expect(request.message).toBe('删除后关联追踪也会停用。');
    expect(request.confirmLabel).toBe('删除');
    expect(request.cancelLabel).toBe('取消');
    expect(request.tone).toBe('danger');
    expect(request.onConfirm).toBe(onConfirm);
  });

  it('allows non-danger confirmation wording when requested', () => {
    const request = createConfirmRequest({
      title: '确认操作？',
      message: '是否继续？',
      confirmLabel: '继续',
      cancelLabel: '先不处理',
      tone: 'default',
      onConfirm: () => undefined,
    });

    expect(request.cancelLabel).toBe('先不处理');
    expect(request.tone).toBe('default');
  });
});
