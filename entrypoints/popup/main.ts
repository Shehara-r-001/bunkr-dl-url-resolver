import { requestDownload, requestUrlResolution } from '../../src/messaging/messages';
import { isBunkrHost } from '../../src/providers/bunkr/urls';
import { addHistoryItem, clearHistory, getHistory, type HistoryItem } from '../../src/storage/history';
import { loadSettings, saveSettings, type UserSettings } from '../../src/storage/settings';
import type { ResolvedDownload } from '../../src/types/download';

// UI Elements - Tabs
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabContents = {
  resolve: document.getElementById('tab-resolve') as HTMLElement,
  history: document.getElementById('tab-history') as HTMLElement,
  settings: document.getElementById('tab-settings') as HTMLElement
};

// UI Elements - Resolver
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const pasteBtn = document.getElementById('paste-btn') as HTMLButtonElement;
const resolveBtn = document.getElementById('resolve-btn') as HTMLButtonElement;
const resolveSpinner = document.getElementById('resolve-spinner') as HTMLElement;
const resolveBtnText = document.getElementById('resolve-btn-text') as HTMLElement;
const progressContainer = document.getElementById('progress-bar-container') as HTMLElement;
const progressText = document.getElementById('progress-text') as HTMLElement;
const statusBox = document.getElementById('status-box') as HTMLElement;
const statusMessage = document.getElementById('status-message') as HTMLElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const copyDiagBtn = document.getElementById('copy-diag-btn') as HTMLButtonElement;
const diagnosticsBox = document.getElementById('diagnostics-box') as HTMLElement;
const diagnosticsText = document.getElementById('diagnostics-text') as HTMLElement;
const resultCard = document.getElementById('result-card') as HTMLElement;
const fileName = document.getElementById('file-name') as HTMLElement;
const expiryBadge = document.getElementById('expiry-badge') as HTMLElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const openTabBtn = document.getElementById('open-tab-btn') as HTMLButtonElement;

// UI Elements - History
const historyList = document.getElementById('history-list') as HTMLElement;
const historyEmpty = document.getElementById('history-empty') as HTMLElement;
const historyDisabledBanner = document.getElementById('history-disabled-banner') as HTMLElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

// UI Elements - Settings
const settingSaveHistory = document.getElementById('setting-save-history') as HTMLInputElement;
const settingAutoPaste = document.getElementById('setting-auto-paste') as HTMLInputElement;
const settingAutoCopy = document.getElementById('setting-auto-copy') as HTMLInputElement;
const settingAutoDownload = document.getElementById('setting-auto-download') as HTMLInputElement;
const toast = document.getElementById('toast') as HTMLElement;

let currentResolved: ResolvedDownload | null = null;
let lastErrorDiagnostics: unknown = null;
let activeSettings: UserSettings;

// --- Tab Navigation ---
function switchTab(tabKey: 'resolve' | 'history' | 'settings') {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });

  Object.entries(tabContents).forEach(([key, element]) => {
    if (element) {
      element.classList.toggle('hidden', key !== tabKey);
      element.classList.toggle('active', key === tabKey);
    }
  });

  if (tabKey === 'history') {
    renderHistory();
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabKey = btn.dataset.tab as 'resolve' | 'history' | 'settings';
    if (tabKey) switchTab(tabKey);
  });
});

// --- Toast Helper ---
function showToast(msg: string) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

// --- Helpers & UI States ---
function showLoading(isLoading: boolean, stage: string = 'Resolving...') {
  if (isLoading) {
    resolveBtn.disabled = true;
    resolveSpinner.classList.remove('hidden');
    resolveBtnText.textContent = 'Resolving';
    progressText.textContent = stage;
    progressContainer.classList.remove('hidden');
    hideStatus();
    resultCard.classList.add('hidden');
  } else {
    resolveBtn.disabled = false;
    resolveSpinner.classList.add('hidden');
    resolveBtnText.textContent = 'Resolve Link';
    progressContainer.classList.add('hidden');
  }
}

function showError(message: string, diagnostics?: unknown) {
  statusMessage.textContent = message;
  statusBox.className = 'status-box error';
  statusBox.classList.remove('hidden');

  lastErrorDiagnostics = diagnostics;
  if (diagnostics) {
    diagnosticsText.textContent =
      typeof diagnostics === 'string'
        ? diagnostics
        : JSON.stringify(diagnostics, null, 2);
    diagnosticsBox.classList.remove('hidden');
  } else {
    diagnosticsBox.classList.add('hidden');
  }
}

function hideStatus() {
  statusBox.classList.add('hidden');
  diagnosticsBox.classList.add('hidden');
  lastErrorDiagnostics = null;
}

function formatExpiry(expiresAtMs?: number): string {
  if (!expiresAtMs) return 'No expiry';
  const diffSec = Math.round((expiresAtMs - Date.now()) / 1000);
  if (diffSec <= 0) return 'Expired';
  if (diffSec < 60) return `Expires in ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `Expires in ${diffMin}m`;
  const diffHours = (diffMin / 60).toFixed(1);
  return `Expires in ${diffHours}h`;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function displayResult(resolved: ResolvedDownload) {
  currentResolved = resolved;
  fileName.textContent = resolved.filename || 'downloaded_file';
  fileName.title = resolved.filename || 'downloaded_file';

  if (resolved.expiresAt) {
    expiryBadge.textContent = formatExpiry(resolved.expiresAt);
    expiryBadge.classList.remove('hidden');
  } else {
    expiryBadge.classList.add('hidden');
  }

  resultCard.classList.remove('hidden');
}

// --- History Rendering ---
async function renderHistory() {
  if (!activeSettings.saveHistory) {
    historyDisabledBanner.classList.remove('hidden');
  } else {
    historyDisabledBanner.classList.add('hidden');
  }

  const items = await getHistory();
  historyList.innerHTML = '';

  if (items.length === 0) {
    historyEmpty.classList.remove('hidden');
    return;
  }

  historyEmpty.classList.add('hidden');

  items.forEach((item: HistoryItem) => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const info = document.createElement('div');
    info.className = 'history-info';

    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = item.filename || item.sourceUrl;
    title.title = item.sourceUrl;

    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = formatRelativeTime(item.timestamp);

    info.appendChild(title);
    info.appendChild(time);

    const reResolveBtn = document.createElement('button');
    reResolveBtn.className = 'btn micro-btn';
    reResolveBtn.textContent = '⚡ Resolve';
    reResolveBtn.addEventListener('click', () => {
      urlInput.value = item.sourceUrl;
      switchTab('resolve');
      handleResolve();
    });

    card.appendChild(info);
    card.appendChild(reResolveBtn);
    historyList.appendChild(card);
  });
}

clearHistoryBtn?.addEventListener('click', async () => {
  await clearHistory();
  renderHistory();
  showToast('History cleared');
});

// --- Resolution Handler ---
async function handleResolve() {
  const url = urlInput.value.trim();
  if (!url) {
    showError('Please enter or paste a Bunkr URL');
    return;
  }

  showLoading(true, 'Fetching Bunkr page...');

  try {
    const result = await requestUrlResolution(url);

    if (result.ok) {
      displayResult(result.value);

      // Record to history if enabled
      await addHistoryItem({
        sourceUrl: url,
        filename: result.value.filename || 'downloaded_file',
        status: 'success'
      });

      // Auto-Copy Option
      if (activeSettings.autoCopyOnResolve && result.value.directUrl) {
        await navigator.clipboard.writeText(result.value.directUrl);
        showToast('✓ Link copied to clipboard');
      }

      // Auto-Download Option
      if (activeSettings.autoDownloadOnResolve && result.value.directUrl) {
        triggerDownload(result.value.directUrl, result.value.filename);
      }
    } else {
      showError(result.error.message, {
        code: result.error.code,
        details: result.error.details,
        timestamp: new Date().toISOString()
      });

      await addHistoryItem({
        sourceUrl: url,
        filename: 'Failed Resolution',
        status: 'error',
        errorMessage: result.error.message
      });
    }
  } catch (err) {
    showError((err as Error)?.message || 'Failed to communicate with extension background');
  } finally {
    showLoading(false);
  }
}

// Paste Handler
pasteBtn?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
    }
  } catch (err) {
    console.error('Failed to read clipboard', err);
  }
});

resolveBtn?.addEventListener('click', handleResolve);
urlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleResolve();
});

retryBtn?.addEventListener('click', handleResolve);

copyDiagBtn?.addEventListener('click', async () => {
  if (!lastErrorDiagnostics) return;
  try {
    await navigator.clipboard.writeText(
      typeof lastErrorDiagnostics === 'string'
        ? lastErrorDiagnostics
        : JSON.stringify(lastErrorDiagnostics, null, 2)
    );
    showToast('Diagnostics copied!');
  } catch {
    showToast('Failed to copy diagnostics');
  }
});

// Copy Direct Link Handler
copyBtn?.addEventListener('click', async () => {
  if (!currentResolved?.directUrl) return;

  try {
    await navigator.clipboard.writeText(currentResolved.directUrl);
    showToast('✓ Copied direct URL');
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = orig;
    }, 1800);
  } catch (err) {
    showError('Failed to copy to clipboard');
  }
});

// Download Helper
async function triggerDownload(directUrl: string, name?: string) {
  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Sending...';

    const response = await requestDownload(directUrl, name);

    if (response.ok) {
      downloadBtn.textContent = '✓ Sent to FDM';
      showToast('Download started');
      setTimeout(() => {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download';
      }, 2500);
    } else {
      showError(`Download failed: ${response.error}`);
      downloadBtn.disabled = false;
      downloadBtn.textContent = '⬇ Download';
    }
  } catch (err) {
    showError((err as Error)?.message || 'Failed to trigger download');
    downloadBtn.disabled = false;
    downloadBtn.textContent = '⬇ Download';
  }
}

downloadBtn?.addEventListener('click', () => {
  if (currentResolved?.directUrl) {
    triggerDownload(currentResolved.directUrl, currentResolved.filename);
  }
});

openTabBtn?.addEventListener('click', () => {
  if (currentResolved?.directUrl) {
    chrome.tabs.create({ url: currentResolved.directUrl });
  }
});

// --- Settings Initializer & Listeners ---
async function initSettings() {
  activeSettings = await loadSettings();

  settingSaveHistory.checked = activeSettings.saveHistory;
  settingAutoPaste.checked = activeSettings.autoPasteOnOpen;
  settingAutoCopy.checked = activeSettings.autoCopyOnResolve;
  settingAutoDownload.checked = activeSettings.autoDownloadOnResolve;

  settingSaveHistory.addEventListener('change', async () => {
    activeSettings = await saveSettings({ saveHistory: settingSaveHistory.checked });
  });

  settingAutoPaste.addEventListener('change', async () => {
    activeSettings = await saveSettings({ autoPasteOnOpen: settingAutoPaste.checked });
  });

  settingAutoCopy.addEventListener('change', async () => {
    activeSettings = await saveSettings({ autoCopyOnResolve: settingAutoCopy.checked });
  });

  settingAutoDownload.addEventListener('change', async () => {
    activeSettings = await saveSettings({ autoDownloadOnResolve: settingAutoDownload.checked });
  });

  // Check for incoming target URL from query parameters or background context menu
  const params = new URLSearchParams(window.location.search);
  let incomingUrl = params.get('url');
  let shouldAutoCopy = params.get('autocopy') === 'true';

  if (!incomingUrl && typeof chrome !== 'undefined' && chrome.storage) {
    const storageArea = chrome.storage.session || chrome.storage.local;
    const sessionData = await new Promise<{ pending_resolve_url?: string; auto_copy?: boolean }>((resolve) => {
      storageArea.get(['pending_resolve_url', 'auto_copy'], (res) => resolve(res || {}));
    });

    if (sessionData.pending_resolve_url) {
      incomingUrl = sessionData.pending_resolve_url;
      shouldAutoCopy = sessionData.auto_copy ?? true;
      storageArea.remove(['pending_resolve_url', 'auto_copy']);
    }
  }

  if (incomingUrl) {
    urlInput.value = incomingUrl;
    switchTab('resolve');
    // Trigger immediate resolution
    handleResolve().then(() => {
      if (shouldAutoCopy && currentResolved?.directUrl) {
        navigator.clipboard.writeText(currentResolved.directUrl).then(() => {
          showToast('✓ Resolved & copied to clipboard!');
        }).catch(() => {});
      }
    });
    return;
  }

  // Auto-paste on popup open if setting is on
  if (activeSettings.autoPasteOnOpen) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        try {
          const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
          if (isBunkrHost(parsed.hostname)) {
            urlInput.value = trimmed;
          }
        } catch {
          // ignore non-URL clipboard text
        }
      }
    } catch {
      // ignore clipboard read permission denials
    }
  }
}

// Bootstrap
initSettings();
