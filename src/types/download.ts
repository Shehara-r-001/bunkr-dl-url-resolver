export type ResolveErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_HOST'
  | 'UNSUPPORTED_PAGE'
  | 'PAGE_FETCH_FAILED'
  | 'FILE_ID_NOT_FOUND'
  | 'DOWNLOAD_API_FAILED'
  | 'SIGN_API_FAILED'
  | 'INVALID_API_RESPONSE'
  | 'RESOLUTION_FAILED'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT';

export class ResolveError extends Error {
  constructor(
    public readonly code: ResolveErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

export interface ResolvedDownload {
  provider: string;
  sourceUrl: string;
  directUrl: string;
  filename?: string;
  expiresAt?: number;
  resolvedAt: number;
}

export type ResolveResult =
  | {
      ok: true;
      value: ResolvedDownload;
    }
  | {
      ok: false;
      error: {
        code: ResolveErrorCode;
        message: string;
        details?: unknown;
      };
    };

export interface ResolveOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}
