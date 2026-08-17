import { ResolveError } from '../../types/download';

const BUNKR_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)*bunkr\.[a-z]{2,8}$/i;

/**
 * Checks if a hostname matches any valid Bunkr domain.
 */
export function isBunkrHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    BUNKR_DOMAIN_PATTERN.test(host) ||
    host === 'bunkrr.su' ||
    host === 'bunkr.su' ||
    host.endsWith('.bunkrr.su')
  );
}

/**
 * Validates and normalizes an input URL string into a parsed URL object.
 */
export function parseAndValidateBunkrUrl(inputUrl: string): URL {
  let trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new ResolveError('INVALID_URL', 'URL cannot be empty');
  }

  // Prepend https:// if user pasted without protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ResolveError('INVALID_URL', `Invalid URL format: ${inputUrl}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ResolveError('INVALID_URL', 'Only HTTP and HTTPS URLs are supported');
  }

  if (!isBunkrHost(parsed.hostname)) {
    throw new ResolveError(
      'UNSUPPORTED_HOST',
      `Hostname "${parsed.hostname}" is not a recognized Bunkr domain`
    );
  }

  return parsed;
}
