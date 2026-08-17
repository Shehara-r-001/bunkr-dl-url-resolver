import type { ResolveResult } from '../types/download';

export type ExtensionMessage =
  | {
      type: 'RESOLVE_URL';
      url: string;
    }
  | {
      type: 'DOWNLOAD_URL';
      url: string;
      filename?: string;
    }
  | {
      type: 'PING';
    };

export type DownloadResponse =
  | {
      ok: true;
      downloadId: number;
    }
  | {
      ok: false;
      error: string;
    };

export type ExtensionResponse =
  | ResolveResult
  | DownloadResponse
  | { ok: true; message: 'pong' };
