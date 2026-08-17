import { ResolveError } from '../../types/download';
import type { ResolveOptions } from '../../types/download';
import { fetchWithRetry } from '../../utils/fetch-with-retry';
import { logger } from '../../utils/logger';
import {
  BunkrDownloadApiResponseSchema,
  BunkrSignResponseSchema
} from './schemas';
import type { BunkrSignResponse } from './schemas';

const DEFAULT_SIGN_API = 'https://glb-apisign.cdn.cr/sign';
const DEFAULT_DOWNLOAD_API = 'https://dl.bunkr.cr/api/_001_v2';

function getSignApiUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env?.WXT_BUNKR_SIGN_API) ||
    DEFAULT_SIGN_API
  );
}

function getDownloadApiUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env?.WXT_BUNKR_DOWNLOAD_API) ||
    DEFAULT_DOWNLOAD_API
  );
}

/**
 * Requests signed token and expiry for a given CDN media path.
 */
export async function signMediaPath(
  mediaPath: string,
  options?: ResolveOptions
): Promise<BunkrSignResponse> {
  const signEndpoint = getSignApiUrl();
  const targetUrl = `${signEndpoint}?path=${encodeURIComponent(mediaPath)}`;

  logger.debug(`Signing media path: ${mediaPath}`);

  try {
    const response = await fetchWithRetry(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: options?.signal,
      timeoutMs: options?.timeoutMs
    });

    const json = await response.json();
    const parsed = BunkrSignResponseSchema.safeParse(json);

    if (!parsed.success) {
      logger.warn('Failed to parse signing API response', parsed.error);
      throw new ResolveError('INVALID_API_RESPONSE', 'Invalid response from URL signing service');
    }

    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof ResolveError) throw err;
    throw new ResolveError('SIGN_API_FAILED', (err as Error)?.message || 'Failed to sign media URL');
  }
}

/**
 * Queries the fallback download API for mediafiles & path when jsCDN is absent.
 */
export async function fetchUnsignedDownloadUrl(
  fileId: string,
  options?: ResolveOptions
): Promise<{ mediafiles: string; path: string }> {
  const downloadEndpoint = getDownloadApiUrl();

  logger.debug(`Querying fallback download API for fileId: ${fileId}`);

  try {
    const response = await fetchWithRetry(downloadEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ id: fileId }),
      signal: options?.signal,
      timeoutMs: options?.timeoutMs
    });

    const json = await response.json();
    const parsed = BunkrDownloadApiResponseSchema.safeParse(json);

    if (!parsed.success || !parsed.data.mediafiles || !parsed.data.path) {
      logger.warn('Fallback download API returned incomplete response', json);
      throw new ResolveError(
        'DOWNLOAD_API_FAILED',
        'Fallback download API did not return valid media information'
      );
    }

    return {
      mediafiles: parsed.data.mediafiles,
      path: parsed.data.path
    };
  } catch (err: unknown) {
    if (err instanceof ResolveError) throw err;
    throw new ResolveError(
      'DOWNLOAD_API_FAILED',
      (err as Error)?.message || 'Failed to query fallback download API'
    );
  }
}
