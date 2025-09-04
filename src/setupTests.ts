import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

// Simple fetch mock; individual tests can override implementations
beforeEach(() => {
  // @ts-ignore
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});
