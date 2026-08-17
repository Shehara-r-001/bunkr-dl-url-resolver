const isDebugEnabled = () => {
  if (typeof process !== 'undefined' && process.env?.WXT_DEBUG === 'true') {
    return true;
  }
  return false;
};

/**
 * Sanitizes URLs to remove sensitive queries (such as tokens or signatures) before logging.
 */
export function sanitizeUrlForLogging(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '[REDACTED]');
    }
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.log('[Bunkr-FDM:DEBUG]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    console.info('[Bunkr-FDM:INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('[Bunkr-FDM:WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[Bunkr-FDM:ERROR]', ...args);
  }
};
