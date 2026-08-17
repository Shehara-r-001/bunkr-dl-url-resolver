import type { ResolvedDownload } from '../types/download';

export type BatchItemState = 'queued' | 'resolving' | 'resolved' | 'failed';

export interface BatchItem {
  id: string;
  sourceUrl: string;
  state: BatchItemState;
  result?: ResolvedDownload;
  error?: string;
}

export interface BatchSummary {
  total: number;
  completed: number;
  resolved: number;
  failed: number;
  inProgress: number;
}

export interface BatchQueueOptions {
  concurrency?: number;
  onItemUpdate?: (item: BatchItem, summary: BatchSummary) => void;
  onComplete?: (summary: BatchSummary) => void;
}
