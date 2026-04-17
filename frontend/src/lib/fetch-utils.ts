/**
 * Fetch helpers shared across the storefront.
 *
 * `fetchWithTimeout` wraps `globalThis.fetch` with an `AbortController` so
 * callers can bound how long an upstream request is allowed to take. A
 * timeout rejects with a `TimeoutError`-named `DOMException`, matching the
 * behaviour of `AbortSignal.timeout()` on modern runtimes.
 */

export class FetchTimeoutError extends Error {
  public override readonly name = "FetchTimeoutError";
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request aborted after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
}

export interface FetchWithTimeoutInit extends RequestInit {
  /** Additional signal to compose with the internal timeout signal. */
  signal?: AbortSignal;
}

/**
 * Run `fetch(url, init)` but abort the request after `ms` milliseconds.
 *
 * If the caller supplies their own `AbortSignal` on `init.signal`, both
 * signals are honoured: aborting either cancels the request.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: FetchWithTimeoutInit = {},
  ms = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  const external = init.signal;
  const onExternalAbort = (): void => controller.abort();
  if (external) {
    if (external.aborted) {
      controller.abort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } catch (err) {
    if (controller.signal.aborted && !(external?.aborted ?? false)) {
      throw new FetchTimeoutError(ms);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    if (external) external.removeEventListener("abort", onExternalAbort);
  }
}
