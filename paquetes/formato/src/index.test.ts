import { describe, expect, it } from 'vitest';
import { ESQUEMA_ACTUAL } from './index';

describe('@rimor/formato', () => {
  it('declara la versión de esquema 1', () => {
    expect(ESQUEMA_ACTUAL).toBe(1);
  });
});
