/**
 * Shared timeout and cancellation utilities.
 *
 * These helpers provide a consistent way to:
 * - Apply request timeouts with AbortSignal (fetchWithTimeout)
 * - Race any promise against a timeout (withTimeout)
 * - Detect abort and timeout errors (isAbortError, isTimeoutError)
 *
 * Note:
 * - fetchWithTimeout combines any provided caller signal with an internal timeout signal.
 *   In modern runtimes, AbortSignal.any is used. A manual fallback is provided otherwise.
 * - withTimeout cannot cancel the underlying operation by itself. Prefer fetchWithTimeout
 *   or passing a signal into APIs that support it for real cancellation.
 */

// Timeout budget constants (adjustable via env in future)
export const CSV_FETCH_TIMEOUT_MS = 8000;
export const SHEETS_TIMEOUT_MS = 10000;
export const API_PROJECT_DATA_TIMEOUT_MS = 12000;
export const CLIENT_FETCH_TIMEOUT_MS = 10000;
export const AI_INSIGHTS_TIMEOUT_MS = 20000;
export const CHAT_TIMEOUT_MS = 25000;

export class TimeoutError extends Error {
  public readonly code = 'TIMEOUT';
  public readonly timeoutMs?: number;
  public readonly label?: string;
  public readonly cause?: unknown;

  constructor(message: string, timeoutMs?: number, label?: string, cause?: unknown) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.label = label;
    // Preserve stack and cause for better diagnostics
    if (cause !== undefined) {
      // Assigning cause preserves compatibility with ErrorOptions in newer runtimes
      (this as any).cause = cause;
    }
  }
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e: any = err as any;
  // Standard DOMException for aborted fetch
  if (e.name === 'AbortError') return true;
  // Node.js sometimes uses codes
  if (typeof e.code === 'string' && e.code.toUpperCase() === 'ABORT_ERR') return true;
  return false;
}

export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if (err instanceof TimeoutError) return true;
  const e: any = err as any;
  // DOM-style TimeoutError (from AbortSignal.timeout in some runtimes)
  if (e.name === 'TimeoutError') return true;
  // Some libs use ETIMEDOUT codes
  if (typeof e.code === 'string' && e.code.toUpperCase() === 'ETIMEDOUT') return true;
  // Check nested cause
  const c: any = e.cause;
  if (c && (c.name === 'TimeoutError' || (typeof c?.code === 'string' && c.code.toUpperCase() === 'ETIMEDOUT'))) {
    return true;
  }
  return false;
}

/**
 * Combine multiple AbortSignals into one. Uses AbortSignal.any when available,
 * otherwise falls back to a manual combiner.
 */
export function combineSignals(signals: AbortSignal[]): AbortSignal {
  const anyFn = (AbortSignal as any).any as undefined | ((signals: AbortSignal[]) => AbortSignal);
  if (typeof anyFn === 'function') {
    return anyFn(signals);
  }
  // Fallback manual combination
  const controller = new AbortController();
  const cleanupFns: Array<() => void> = [];

  const abortOnce = (reason?: unknown) => {
    try {
      controller.abort(reason);
    } catch {
      // no-op
    }
    cleanupFns.forEach((fn) => {
      try { fn(); } catch {}
    });
  };

  for (const s of signals) {
    if (s.aborted) {
      abortOnce((s as any).reason);
      return controller.signal;
    }
    const listener = () => abortOnce((s as any).reason);
    s.addEventListener('abort', listener, { once: true } as any);
    cleanupFns.push(() => s.removeEventListener('abort', listener) as any);
  }

  return controller.signal;
}

/**
 * Create a timeout AbortSignal. Uses AbortSignal.timeout when available,
 * otherwise falls back to a manual AbortController + setTimeout.
 */
function createTimeoutSignal(timeoutMs: number, label?: string): { signal: AbortSignal; cancel: () => void } {
  const timeoutFn = (AbortSignal as any).timeout as undefined | ((ms: number) => AbortSignal);
  if (typeof timeoutFn === 'function') {
    // Built-in timeout signals can't be "cancelled" programmatically, but that's okay.
    return { signal: timeoutFn(timeoutMs), cancel: () => {} };
  }
  // Fallback manual timeout
  const controller = new AbortController();
  const id = setTimeout(() => {
    console.warn(`Timeout in ${label} after ${timeoutMs}ms`);
    controller.abort(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs, label));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(id),
  };
}

/**
 * Wrap fetch with a timeout using AbortSignals. Any provided caller signal
 * will be combined with the internal timeout signal so either can cancel.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const { signal: callerSignal, ...rest } = init;

  const { signal: timeoutSignal, cancel: cancelTimeout } = createTimeoutSignal(timeoutMs, 'fetch');
  const combinedSignal = callerSignal ? combineSignals([callerSignal, timeoutSignal]) : timeoutSignal;

  try {
    const res = await fetch(input, { ...rest, signal: combinedSignal } as RequestInit);
    return res;
  } catch (err) {
    // If this is an abort due to our timeout signal, surface a TimeoutError
    const reason: any = (combinedSignal as any)?.reason;
    if (isAbortError(err) && (reason?.name === 'TimeoutError' || isTimeoutError(reason))) {
      throw new TimeoutError(`Fetch timed out after ${timeoutMs}ms`, timeoutMs, 'fetch', err);
    }
    throw err;
  } finally {
    // Clear manual timer in fallback implementation
    cancelTimeout();
  }
}

/**
 * Race any promise against a timeout. This does not cancel the underlying work;
 * prefer passing a signal to APIs that support it for real cancellation.
 */
export function withTimeout<T>(
  promise: PromiseLike<T> | (() => PromiseLike<T>),
  timeoutMs: number, 
  label?: string
): Promise<T> {
  // Handle both direct promises and functions that return a promise
  const promiseToRace = typeof promise === 'function' ? promise() : promise;
  
  if (!promiseToRace || typeof promiseToRace.then !== 'function') {
    throw new TypeError(`Expected a Promise or function returning a Promise, got ${typeof promiseToRace}`);
  }

  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new TimeoutError(
        `Operation timed out${label ? ` [${label}]` : ''} after ${timeoutMs}ms`, 
        timeoutMs, 
        label
      ));
    }, timeoutMs);

    promiseToRace.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}
