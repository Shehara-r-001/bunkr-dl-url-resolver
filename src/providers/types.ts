import type { ResolvedDownload, ResolveOptions } from '../types/download';

export interface DownloadProvider {
  readonly id: string;
  readonly name: string;
  canHandle(url: URL): boolean;
  resolve(url: URL, options?: ResolveOptions): Promise<ResolvedDownload>;
}
