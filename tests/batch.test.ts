import { describe, expect, it } from 'bun:test';
import { BatchQueue, parseBatchUrls } from '../src/batch/queue';
import type { DownloadProvider } from '../src/providers/types';
import { defaultRegistry } from '../src/resolver/registry';
import type { ResolvedDownload } from '../src/types/download';

describe('Batch URLs Parser', () => {
  it('parses, trims, validates, and deduplicates multi-line URLs', () => {
    const rawInput = `
      https://dl.bunkr.cr/file/item1
      bunkr.is/v/item2
      https://dl.bunkr.cr/file/item1
      https://google.com/random
      bunkr.site/file/item3, https://bunkr.black/file/item4
    `;

    const parsed = parseBatchUrls(rawInput);
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toBe('https://dl.bunkr.cr/file/item1');
    expect(parsed[1]).toBe('https://bunkr.is/v/item2');
    expect(parsed[2]).toBe('https://bunkr.site/file/item3');
    expect(parsed[3]).toBe('https://bunkr.black/file/item4');
  });

  it('handles empty input gracefully', () => {
    expect(parseBatchUrls('')).toEqual([]);
    expect(parseBatchUrls('   \n\n  ')).toEqual([]);
  });
});

describe('BatchQueue Execution', () => {
  const mockProvider: DownloadProvider = {
    id: 'bunkr-mock-batch',
    name: 'Mock Batch',
    canHandle: (url: URL) => url.hostname.includes('bunkr'),
    resolve: async (url: URL): Promise<ResolvedDownload> => {
      if (url.pathname.includes('fail')) {
        throw new Error('Mock resolution error');
      }
      return {
        provider: 'bunkr',
        sourceUrl: url.toString(),
        directUrl: `https://cdn.example.com${url.pathname}?token=abc&ex=1800000`,
        filename: `${url.pathname.split('/').pop()}.mp4`,
        resolvedAt: Date.now()
      };
    }
  };

  defaultRegistry.register(mockProvider);

  it('resolves batch items with bounded concurrency and generates correct summary', async () => {
    const urls = [
      'https://dl.bunkr.cr/file/item1',
      'https://dl.bunkr.cr/file/item2',
      'https://dl.bunkr.cr/file/item-fail'
    ];

    const queue = new BatchQueue(urls, { concurrency: 2 });
    const summary = await queue.start();

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(3);
    expect(summary.resolved).toBe(2);
    expect(summary.failed).toBe(1);

    const items = queue.getItems();
    expect(items[0]!.state).toBe('resolved');
    expect(items[0]!.result?.directUrl).toContain('token=abc');
    expect(items[2]!.state).toBe('failed');
    expect(items[2]!.error).toBe('Mock resolution error');
  });
});
