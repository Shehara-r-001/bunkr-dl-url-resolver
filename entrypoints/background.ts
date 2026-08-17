import type { ExtensionMessage } from '../src/messaging/types';
import { BunkrProvider } from '../src/providers/bunkr/bunkr.provider';
import { sanitizeFilename } from '../src/providers/bunkr/parser';
import { defaultRegistry } from '../src/resolver/registry';
import { logger } from '../src/utils/logger';

export default defineBackground(() => {
  logger.info('Bunkr → FDM Resolver background worker started');

  // Register providers
  const bunkrProvider = new BunkrProvider();
  defaultRegistry.register(bunkrProvider);

  // Message listener
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    logger.debug('Received extension message:', message.type);

    if (message.type === 'PING') {
      sendResponse({ ok: true, message: 'pong' });
      return false;
    }

    if (message.type === 'RESOLVE_URL') {
      defaultRegistry
        .resolve(message.url)
        .then((result) => {
          sendResponse(result);
        })
        .catch((err) => {
          sendResponse({
            ok: false,
            error: {
              code: 'RESOLUTION_FAILED',
              message: (err as Error)?.message || 'Failed to resolve URL'
            }
          });
        });
      return true; // Keep channel open for async response
    }

    if (message.type === 'DOWNLOAD_URL') {
      const { url, filename } = message;
      const cleanFilename = filename ? sanitizeFilename(filename) : undefined;

      const triggerDownload = (useFilename?: string) => {
        chrome.downloads.download(
          {
            url,
            filename: useFilename || undefined,
            saveAs: false
          },
          (downloadId) => {
            const err = chrome.runtime.lastError;
            if (err) {
              // If failed due to filename, retry automatically without explicit filename
              if (useFilename && err.message?.toLowerCase().includes('filename')) {
                logger.warn('Download rejected custom filename, retrying without filename override...');
                triggerDownload(undefined);
                return;
              }
              sendResponse({
                ok: false,
                error: err.message
              });
            } else {
              sendResponse({
                ok: true,
                downloadId
              });
            }
          }
        );
      };

      triggerDownload(cleanFilename);
      return true; // Keep channel open for async response
    }

    return false;
  });
});
