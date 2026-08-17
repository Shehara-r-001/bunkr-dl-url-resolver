import type { ResolveResult } from '../types/download';
import type { DownloadResponse, ExtensionMessage } from './types';

/**
 * Sends a message from the popup/content to the background service worker.
 */
export async function sendExtensionMessage<T = unknown>(
  message: ExtensionMessage
): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    });
  }
  throw new Error('Chrome runtime messaging is not available');
}

export async function requestUrlResolution(url: string): Promise<ResolveResult> {
  return sendExtensionMessage<ResolveResult>({
    type: 'RESOLVE_URL',
    url
  });
}

export async function requestDownload(
  url: string,
  filename?: string
): Promise<DownloadResponse> {
  return sendExtensionMessage<DownloadResponse>({
    type: 'DOWNLOAD_URL',
    url,
    filename
  });
}
