import { isBunkrHost } from '../providers/bunkr/urls';
import { defaultRegistry } from '../resolver/registry';
import { addHistoryItem } from '../storage/history';
import { logger } from '../utils/logger';
import type { BatchItem, BatchQueueOptions, BatchSummary } from './types';

/**
 * Parses raw text input into a deduplicated list of valid Bunkr URLs.
 */
export function parseBatchUrls(rawInput: string): string[] {
  if (!rawInput) return [];

  const rawTokens = rawInput
    .split(/[\r\n,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const validUrls: string[] = [];

  for (const token of rawTokens) {
    try {
      const candidate = token.startsWith('http') ? token : `https://${token}`;
      const parsed = new URL(candidate);
      if (isBunkrHost(parsed.hostname)) {
        const normalized = parsed.toString();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          validUrls.push(normalized);
        }
      }
    } catch {
      // ignore invalid tokens
    }
  }

  return validUrls;
}

export class BatchQueue {
  private items: BatchItem[] = [];
  private concurrency: number;
  private isRunning = false;
  private isCancelled = false;
  private onItemUpdate?: (item: BatchItem, summary: BatchSummary) => void;
  private onComplete?: (summary: BatchSummary) => void;

  constructor(urls: string[], options: BatchQueueOptions = {}) {
    this.concurrency = options.concurrency || 3;
    this.onItemUpdate = options.onItemUpdate;
    this.onComplete = options.onComplete;

    this.items = urls.map((url, index) => ({
      id: `batch_${Date.now()}_${index}`,
      sourceUrl: url,
      state: 'queued'
    }));
  }

  public getItems(): BatchItem[] {
    return this.items;
  }

  public getSummary(): BatchSummary {
    const total = this.items.length;
    const resolved = this.items.filter((i) => i.state === 'resolved').length;
    const failed = this.items.filter((i) => i.state === 'failed').length;
    const inProgress = this.items.filter((i) => i.state === 'resolving').length;
    const completed = resolved + failed;

    return {
      total,
      completed,
      resolved,
      failed,
      inProgress
    };
  }

  public cancel(): void {
    this.isCancelled = true;
    this.isRunning = false;
  }

  public async start(): Promise<BatchSummary> {
    if (this.isRunning) return this.getSummary();
    this.isRunning = true;
    this.isCancelled = false;

    logger.info(`Starting batch resolution for ${this.items.length} items (concurrency: ${this.concurrency})`);

    const queue = [...this.items.filter((i) => i.state === 'queued')];
    const workers = Array.from({ length: Math.min(this.concurrency, queue.length) }, () =>
      this.runWorker(queue)
    );

    await Promise.all(workers);
    this.isRunning = false;

    const summary = this.getSummary();
    if (this.onComplete) {
      this.onComplete(summary);
    }

    return summary;
  }

  private async runWorker(queue: BatchItem[]): Promise<void> {
    while (queue.length > 0 && !this.isCancelled) {
      const item = queue.shift();
      if (!item) break;

      item.state = 'resolving';
      if (this.onItemUpdate) this.onItemUpdate(item, this.getSummary());

      try {
        const result = await defaultRegistry.resolve(item.sourceUrl);

        if (this.isCancelled) break;

        if (result.ok) {
          item.state = 'resolved';
          item.result = result.value;

          // Record to history if enabled
          addHistoryItem({
            sourceUrl: item.sourceUrl,
            filename: result.value.filename || 'downloaded_file',
            status: 'success'
          }).catch(() => {});
        } else {
          item.state = 'failed';
          item.error = result.error.message;

          addHistoryItem({
            sourceUrl: item.sourceUrl,
            filename: 'Failed Resolution',
            status: 'error',
            errorMessage: result.error.message
          }).catch(() => {});
        }
      } catch (err) {
        if (this.isCancelled) break;
        item.state = 'failed';
        item.error = (err as Error)?.message || 'Resolution error';
      }

      if (this.onItemUpdate) this.onItemUpdate(item, this.getSummary());
    }
  }

  public async retryFailed(): Promise<BatchSummary> {
    const failedItems = this.items.filter((i) => i.state === 'failed');
    for (const item of failedItems) {
      item.state = 'queued';
      item.error = undefined;
    }
    return this.start();
  }
}
