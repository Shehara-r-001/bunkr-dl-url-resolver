import type { ExtensionMessage } from '../src/messaging/types';
import { BunkrProvider } from '../src/providers/bunkr/bunkr.provider';
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
      chrome.downloads.download(
        {
          url,
          filename: filename || undefined,
          saveAs: false
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              error: chrome.runtime.lastError.message
            });
          } else {
            sendResponse({
              ok: true,
              downloadId
            });
          }
        }
      );
      return true; // Keep channel open for async response
    }

    return false;
  });
});
