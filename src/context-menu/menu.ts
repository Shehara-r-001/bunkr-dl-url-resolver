import { sanitizeFilename } from '../providers/bunkr/parser';
import { isBunkrHost } from '../providers/bunkr/urls';
import { defaultRegistry } from '../resolver/registry';
import { addHistoryItem } from '../storage/history';
import { logger } from '../utils/logger';

export const MENU_ID_DOWNLOAD = 'bunkr-fdm-download';
export const MENU_ID_COPY = 'bunkr-fdm-copy';

/**
 * Creates context menu items when the extension is installed or updated.
 */
export function setupContextMenus(): void {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  chrome.contextMenus.removeAll(() => {
    // 1. Download with FDM
    chrome.contextMenus.create({
      id: MENU_ID_DOWNLOAD,
      title: '⬇ Download with FDM',
      contexts: ['link', 'selection']
    });

    // 2. Copy Direct URL
    chrome.contextMenus.create({
      id: MENU_ID_COPY,
      title: '📋 Resolve & Copy Direct URL',
      contexts: ['link', 'selection']
    });

    logger.info('Registered context menu actions');
  });
}

/**
 * Extracts and validates a potential Bunkr URL from context menu click info.
 */
export function extractUrlFromMenuClick(
  info: chrome.contextMenus.OnClickData
): string | null {
  const raw = info.linkUrl || info.selectionText?.trim();
  if (!raw) return null;

  try {
    const candidate = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    if (isBunkrHost(parsed.hostname)) {
      return candidate;
    }
  } catch {
    // not a valid URL
  }
  return null;
}

/**
 * Displays a lightweight desktop notification to inform the user of resolution status.
 */
function showNotification(title: string, message: string): void {
  if (typeof chrome !== 'undefined' && chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon/128.png'),
      title,
      message,
      priority: 1
    });
  }
}

/**
 * Handles context menu clicks from background service worker.
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData
): Promise<void> {
  const targetUrl = extractUrlFromMenuClick(info);
  if (!targetUrl) {
    showNotification('Bunkr → FDM', 'The selected link or text is not a recognized Bunkr URL.');
    return;
  }

  showNotification('Bunkr → FDM', 'Resolving Bunkr link...');

  try {
    const result = await defaultRegistry.resolve(targetUrl);

    if (!result.ok) {
      showNotification('Resolution Failed', result.error.message);
      await addHistoryItem({
        sourceUrl: targetUrl,
        filename: 'Failed Resolution',
        status: 'error',
        errorMessage: result.error.message
      });
      return;
    }

    const { directUrl, filename } = result.value;

    // Record success to history if enabled
    await addHistoryItem({
      sourceUrl: targetUrl,
      filename: filename || 'downloaded_file',
      status: 'success'
    });

    if (info.menuItemId === MENU_ID_DOWNLOAD) {
      // Trigger download
      const cleanFilename = filename ? sanitizeFilename(filename) : undefined;
      chrome.downloads.download(
        {
          url: directUrl,
          filename: cleanFilename,
          saveAs: false
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            // Retry without filename if browser rejected name
            chrome.downloads.download({ url: directUrl, saveAs: false }, (retryId) => {
              if (chrome.runtime.lastError) {
                showNotification('Download Failed', chrome.runtime.lastError.message || 'Error');
              } else {
                showNotification('Download Started', `${filename || 'File'} sent to FDM`);
              }
            });
          } else {
            showNotification('Download Started', `${filename || 'File'} sent to FDM`);
          }
        }
      );
    } else if (info.menuItemId === MENU_ID_COPY) {
      // Direct URL notification with truncated display
      showNotification('Direct Link Ready', `Resolved: ${filename || directUrl.slice(0, 45)}...`);
    }
  } catch (err) {
    showNotification('Error', (err as Error)?.message || 'Failed to resolve link');
  }
}
