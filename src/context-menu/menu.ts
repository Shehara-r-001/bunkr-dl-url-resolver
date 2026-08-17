import { sanitizeFilename } from '../providers/bunkr/parser';
import { isBunkrHost } from '../providers/bunkr/urls';
import { defaultRegistry } from '../resolver/registry';
import { addHistoryItem } from '../storage/history';
import { logger } from '../utils/logger';

export const MENU_ID_DOWNLOAD = 'bunkr-fdm-download';
export const MENU_ID_RESOLVE_POPUP = 'bunkr-fdm-resolve-popup';

/**
 * Creates context menu items when the extension is installed or updated.
 */
export function setupContextMenus(): void {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  chrome.contextMenus.removeAll(() => {
    // 1. Download with FDM (direct background action)
    chrome.contextMenus.create({
      id: MENU_ID_DOWNLOAD,
      title: '⬇ Download with FDM',
      contexts: ['link', 'selection']
    });

    // 2. Resolve in Extension & Copy (opens extension popup)
    chrome.contextMenus.create({
      id: MENU_ID_RESOLVE_POPUP,
      title: '⚡ Resolve in Extension & Copy URL',
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
 * Opens the extension popup with the target URL pre-loaded and set to auto-resolve/copy.
 */
export async function openExtensionWithUrl(url: string, autoCopy = true): Promise<void> {
  const popupUrl = chrome.runtime.getURL(`popup.html?url=${encodeURIComponent(url)}&autocopy=${autoCopy}`);

  // Set pending state in session/local storage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const storageArea = chrome.storage.session || chrome.storage.local;
    await new Promise<void>((resolve) => {
      storageArea.set({ pending_resolve_url: url, auto_copy: autoCopy }, () => resolve());
    });
  }

  // Try opening popup via modern API
  if (typeof chrome !== 'undefined' && chrome.action?.openPopup) {
    try {
      await chrome.action.openPopup();
      return;
    } catch {
      // Fallback below
    }
  }

  // Fallback: Open in dedicated compact popup window
  if (typeof chrome !== 'undefined' && chrome.windows?.create) {
    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 400,
      height: 480,
      focused: true
    });
  } else if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url: popupUrl });
  }
}

/**
 * Displays a desktop notification.
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

  // If user selected "Resolve in Extension & Copy URL", open popup directly!
  if (info.menuItemId === MENU_ID_RESOLVE_POPUP) {
    await openExtensionWithUrl(targetUrl, true);
    return;
  }

  // Otherwise, handle "Download with FDM" in background
  if (info.menuItemId === MENU_ID_DOWNLOAD) {
    showNotification('Bunkr → FDM', 'Resolving Bunkr link for FDM...');

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

      const cleanFilename = filename ? sanitizeFilename(filename) : undefined;
      chrome.downloads.download(
        {
          url: directUrl,
          filename: cleanFilename,
          saveAs: false
        },
        () => {
          if (chrome.runtime.lastError) {
            // Retry without filename if browser rejected name
            chrome.downloads.download({ url: directUrl, saveAs: false }, () => {
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
    } catch (err) {
      showNotification('Error', (err as Error)?.message || 'Failed to resolve link');
    }
  }
}
