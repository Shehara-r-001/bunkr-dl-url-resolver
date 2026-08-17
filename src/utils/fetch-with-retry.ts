import { ResolveError } from '../types/download';
import { logger, sanitizeUrlForLogging } from './logger';

export interface FetchWithRetryOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 410, 422]);

export async function fetchWithRetry(
  url: string | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 15000,
    maxRetries = 2,
    initialDelayMs = 500,
    maxDelayMs = 3000,
    ...fetchOptions
  } = options;

  const urlString = url.toString();
  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    attempt++;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
    }

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    try {
      logger.debug(`Fetching (${attempt}/${maxRetries + 1}): ${sanitizeUrlForLogging(urlString)}`);

      const response = await fetch(urlString, {
        ...fetchOptions,
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      if (NON_RETRYABLE_STATUSES.has(response.status) || attempt > maxRetries) {
        if (response.status === 429) {
          throw new ResolveError('RATE_LIMITED', `Rate limited by host: HTTP ${response.status}`, {
            status: response.status,
            url: sanitizeUrlForLogging(urlString)
          });
        }
        throw new ResolveError('NETWORK_ERROR', `Request failed with HTTP status ${response.status}`, {
          status: response.status,
          url: sanitizeUrlForLogging(urlString)
        });
      }

      // Handle 429 retry after header if present
      const retryAfterHeader = response.headers.get('Retry-After');
      let backoffMs = delay;
      if (retryAfterHeader) {
        const retryAfterSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryAfterSec) && retryAfterSec > 0) {
          backoffMs = retryAfterSec * 1000;
        }
      }

      // Exponential jittered backoff
      const jitter = Math.random() * 200;
      const waitTime = Math.min(backoffMs + jitter, maxDelayMs);
      logger.warn(`HTTP ${response.status}. Retrying in ${Math.round(waitTime)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      delay = Math.min(delay * 2, maxDelayMs);
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);

      const isAbort = (err as Error)?.name === 'AbortError' || controller.signal.aborted;
      if (isAbort && !fetchOptions.signal?.aborted) {
        throw new ResolveError('TIMEOUT', `Request timed out after ${timeoutMs}ms`);
      }

      if (attempt > maxRetries || err instanceof ResolveError) {
        if (err instanceof ResolveError) throw err;
        throw new ResolveError('NETWORK_ERROR', (err as Error)?.message || 'Network request failed', {
          url: sanitizeUrlForLogging(urlString)
        });
      }

      const jitter = Math.random() * 200;
      const waitTime = Math.min(delay + jitter, maxDelayMs);
      logger.warn(`Network failure: ${(err as Error)?.message}. Retrying in ${Math.round(waitTime)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
