import { describe, expect, it } from 'vitest';
import { createToast } from './toast';

describe('createToast', () => {
  it('creates an info toast by default', () => {
    expect(createToast('同步完成', undefined, () => 123)).toEqual({
      id: 123,
      message: '同步完成',
      tone: 'info',
    });
  });

  it('creates a toast with an explicit tone', () => {
    expect(createToast('保存失败', 'error', () => 456)).toEqual({
      id: 456,
      message: '保存失败',
      tone: 'error',
    });
  });
});
