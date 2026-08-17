import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BunkrProvider } from '../src/providers/bunkr/bunkr.provider';
import type { DownloadProvider } from '../src/providers/types';
import { ProviderRegistry } from '../src/resolver/registry';
import type { ResolvedDownload } from '../src/types/download';

describe('Provider Registry', () => {
  it('registers and dispatches to appropriate provider', async () => {
    const registry = new ProviderRegistry();

    const mockProvider: DownloadProvider = {
      id: 'mock-bunkr',
      name: 'Mock Bunkr',
      canHandle: (url: URL) => url.hostname.endsWith('bunkr.cr'),
      resolve: async (url: URL): Promise<ResolvedDownload> => ({
        provider: 'mock-bunkr',
        sourceUrl: url.toString(),
        directUrl: 'https://cdn.example.com/file.mp4?token=mocktoken&ex=1800000000',
        filename: 'file.mp4',
        resolvedAt: Date.now()
      })
    };

    registry.register(mockProvider);

    const result = await registry.resolve('https://dl.bunkr.cr/file/test-file');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe('mock-bunkr');
      expect(result.value.directUrl).toContain('mocktoken');
      expect(result.value.filename).toBe('file.mp4');
    }
  });

  it('returns error result for unsupported domains', async () => {
    const registry = new ProviderRegistry();
    const result = await registry.resolve('https://unsupported-host.com/123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_HOST');
    }
  });
});

describe('BunkrProvider Integration Resolution', () => {
  const jsCdnHtml = readFileSync(join(__dirname, 'fixtures/js-cdn-page.html'), 'utf-8');
  const fallbackHtml = readFileSync(join(__dirname, 'fixtures/fallback-page.html'), 'utf-8');

  it('resolves item via jsCDN and signs media path', async () => {
    const provider = new BunkrProvider();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (urlInput: string | URL) => {
      const url = urlInput.toString();
      if (url.includes('bunkr.cr/file/test-js-cdn')) {
        return new Response(jsCdnHtml, { status: 200 });
      }
      if (url.includes('/sign?path=')) {
        return new Response(
          JSON.stringify({ token: 'signed-token-123', ex: '1900000000' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      const resolved = await provider.resolve(new URL('https://dl.bunkr.cr/file/test-js-cdn'));
      expect(resolved.provider).toBe('bunkr');
      expect(resolved.filename).toBe('Sample Video Clip.mp4');
      expect(resolved.directUrl).toContain('token=signed-token-123');
      expect(resolved.directUrl).toContain('ex=1900000000');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('resolves item via fallback _001_v2 API when jsCDN is absent', async () => {
    const provider = new BunkrProvider();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (urlInput: string | URL, init?: RequestInit) => {
      const url = urlInput.toString();
      if (url.includes('bunkr.cr/file/test-fallback')) {
        return new Response(fallbackHtml, { status: 200 });
      }
      if (url.includes('/api/_001_v2')) {
        return new Response(
          JSON.stringify({
            mediafiles: 'https://media-fallback.bunkr.is',
            path: '/storage/media/fallback-image.jpg'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/sign?path=')) {
        return new Response(
          JSON.stringify({ token: 'signed-fallback-token', ex: '1900000000' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      const resolved = await provider.resolve(new URL('https://dl.bunkr.cr/file/test-fallback'));
      expect(resolved.provider).toBe('bunkr');
      expect(resolved.filename).toBe('Fallback Image Item.jpg');
      expect(resolved.directUrl).toContain('token=signed-fallback-token');
      expect(resolved.directUrl).toContain('https://media-fallback.bunkr.is/storage/media/fallback-image.jpg');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
