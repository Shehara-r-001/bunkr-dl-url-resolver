import type { DownloadProvider } from '../providers/types';
import { ResolveError } from '../types/download';
import type { ResolvedDownload, ResolveOptions, ResolveResult } from '../types/download';

export class ProviderRegistry {
  private providers: Map<string, DownloadProvider> = new Map();

  public register(provider: DownloadProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProviderForUrl(url: URL): DownloadProvider | null {
    for (const provider of this.providers.values()) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    return null;
  }

  public async resolve(
    urlInput: string | URL,
    options?: ResolveOptions
  ): Promise<ResolveResult> {
    try {
      let parsedUrl: URL;
      if (typeof urlInput === 'string') {
        let trimmed = urlInput.trim();
        if (!trimmed) {
          throw new ResolveError('INVALID_URL', 'URL cannot be empty');
        }
        if (!/^https?:\/\//i.test(trimmed)) {
          trimmed = `https://${trimmed}`;
        }
        try {
          parsedUrl = new URL(trimmed);
        } catch {
          throw new ResolveError('INVALID_URL', `Invalid URL format: ${urlInput}`);
        }
      } else {
        parsedUrl = urlInput;
      }

      const provider = this.getProviderForUrl(parsedUrl);
      if (!provider) {
        throw new ResolveError(
          'UNSUPPORTED_HOST',
          `No provider found for domain: ${parsedUrl.hostname}`
        );
      }

      const value: ResolvedDownload = await provider.resolve(parsedUrl, options);
      return { ok: true, value };
    } catch (err: unknown) {
      if (err instanceof ResolveError) {
        return {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details
          }
        };
      }
      return {
        ok: false,
        error: {
          code: 'RESOLUTION_FAILED',
          message: (err as Error)?.message || 'An unexpected error occurred'
        }
      };
    }
  }
}

export const defaultRegistry = new ProviderRegistry();
