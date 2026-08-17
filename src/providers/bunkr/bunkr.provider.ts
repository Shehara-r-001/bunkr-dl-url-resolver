import { ResolveError } from '../../types/download';
import type { ResolvedDownload, ResolveOptions } from '../../types/download';
import { fetchWithRetry } from '../../utils/fetch-with-retry';
import { logger } from '../../utils/logger';
import type { DownloadProvider } from '../types';
import { fetchUnsignedDownloadUrl, signMediaPath } from './api';
import { extractFileId, extractFileName, extractJsCdn } from './parser';
import { isBunkrHost } from './urls';

export const BUNKR_RESOLVER_VERSION = 1;

export class BunkrProvider implements DownloadProvider {
  public readonly id = 'bunkr';
  public readonly name = 'Bunkr';

  public canHandle(url: URL): boolean {
    return isBunkrHost(url.hostname);
  }

  public async resolve(url: URL, options?: ResolveOptions): Promise<ResolvedDownload> {
    logger.info(`Starting resolution for Bunkr URL: ${url.hostname}${url.pathname}`);

    // Step 1: Fetch page HTML
    let html: string;
    try {
      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': navigator.userAgent
        },
        signal: options?.signal,
        timeoutMs: options?.timeoutMs
      });
      html = await response.text();
    } catch (err: unknown) {
      if (err instanceof ResolveError) throw err;
      throw new ResolveError(
        'PAGE_FETCH_FAILED',
        (err as Error)?.message || 'Failed to fetch Bunkr item page'
      );
    }

    // Step 2: Extract jsCDN or fallback file ID
    let baseUrl: string;
    let mediaPath: string;

    const jsCdn = extractJsCdn(html);
    if (jsCdn) {
      logger.debug(`Found jsCDN: ${jsCdn}`);
      baseUrl = jsCdn;
      try {
        const cdnUrl = new URL(jsCdn);
        mediaPath = cdnUrl.pathname;
      } catch {
        mediaPath = jsCdn.replace(/^https?:\/\/[^/]+/, '');
      }
    } else {
      logger.debug('jsCDN not found in HTML. Attempting fallback API...');
      const fileId = extractFileId(html);
      if (!fileId) {
        throw new ResolveError(
          'FILE_ID_NOT_FOUND',
          'Could not find CDN URL or file ID on the Bunkr page'
        );
      }

      const fallback = await fetchUnsignedDownloadUrl(fileId, options);
      // Combine mediafiles domain and path
      const baseDomain = fallback.mediafiles.replace(/\/+$/, '');
      const rawPath = fallback.path.startsWith('/') ? fallback.path : `/${fallback.path}`;
      baseUrl = `${baseDomain}${rawPath}`;

      // Derive standard media path for signing
      const segments = rawPath.split('/').filter(Boolean);
      const slug = segments[segments.length - 1] || 'file';
      mediaPath = `/storage/media/${slug}`;
    }

    // Step 3: Sign the media path
    let directUrl = baseUrl;
    let expiresAt: number | undefined;

    try {
      const signature = await signMediaPath(mediaPath, options);
      if (signature.token && signature.ex) {
        const parsedBase = new URL(baseUrl);
        parsedBase.searchParams.set('token', signature.token);
        parsedBase.searchParams.set('ex', String(signature.ex));
        directUrl = parsedBase.toString();

        const numExpiry = typeof signature.ex === 'number' ? signature.ex : parseInt(signature.ex, 10);
        if (!isNaN(numExpiry) && numExpiry > 0) {
          // If expiry is in seconds timestamp, convert to ms
          expiresAt = numExpiry < 1e11 ? numExpiry * 1000 : numExpiry;
        }
      } else {
        logger.warn('Signing service returned empty token or expiry; using unsigned URL');
      }
    } catch (err) {
      logger.warn('Signing step encountered error; returning baseUrl if available', err);
      // If signing fails, check if we can still return baseUrl or rethrow
      if (!baseUrl) {
        throw err;
      }
    }

    // Step 4: Extract filename
    const filename = extractFileName(html, baseUrl);

    logger.info(`Successfully resolved: ${filename}`);

    return {
      provider: this.id,
      sourceUrl: url.toString(),
      directUrl,
      filename,
      expiresAt,
      resolvedAt: Date.now()
    };
  }
}
