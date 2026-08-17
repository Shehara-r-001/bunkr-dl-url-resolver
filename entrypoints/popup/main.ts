import { requestDownload, requestUrlResolution } from '../../src/messaging/messages';
import type { ResolvedDownload } from '../../src/types/download';

// UI Elements
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const pasteBtn = document.getElementById('paste-btn') as HTMLButtonElement;
const resolveBtn = document.getElementById('resolve-btn') as HTMLButtonElement;
const resolveSpinner = document.getElementById('resolve-spinner') as HTMLElement;
const statusBox = document.getElementById('status-box') as HTMLElement;
const statusMessage = document.getElementById('status-message') as HTMLElement;
const diagnosticsBox = document.getElementById('diagnostics-box') as HTMLElement;
const diagnosticsText = document.getElementById('diagnostics-text') as HTMLElement;
const resultCard = document.getElementById('result-card') as HTMLElement;
const fileName = document.getElementById('file-name') as HTMLElement;
const expiryBadge = document.getElementById('expiry-badge') as HTMLElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;

let currentResolved: ResolvedDownload | null = null;

// Helpers
function showLoading(isLoading: boolean) {
  if (isLoading) {
    resolveBtn.disabled = true;
    resolveSpinner.classList.remove('hidden');
    hideStatus();
    resultCard.classList.add('hidden');
  } else {
    resolveBtn.disabled = false;
    resolveSpinner.classList.add('hidden');
  }
}

function showError(message: string, diagnostics?: unknown) {
  statusBox.className = 'status-box error';
  statusMessage.textContent = message;
  statusBox.classList.remove('hidden');

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

// Resolve Handler
async function handleResolve() {
  const url = urlInput.value.trim();
  if (!url) {
    showError('Please enter or paste a Bunkr URL');
    return;
  }

  showLoading(true);

  try {
    const result = await requestUrlResolution(url);

    if (result.ok) {
      displayResult(result.value);
    } else {
      showError(result.error.message, {
        code: result.error.code,
        details: result.error.details
      });
    }
  } catch (err) {
    showError((err as Error)?.message || 'Failed to communicate with extension background');
  } finally {
    showLoading(false);
  }
}

resolveBtn?.addEventListener('click', handleResolve);
urlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleResolve();
  }
});

// Copy Handler
copyBtn?.addEventListener('click', async () => {
  if (!currentResolved?.directUrl) return;

  try {
    await navigator.clipboard.writeText(currentResolved.directUrl);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 1800);
  } catch (err) {
    showError('Failed to copy to clipboard');
  }
});

// Download Handler
downloadBtn?.addEventListener('click', async () => {
  if (!currentResolved?.directUrl) return;

  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Sending...';

    const response = await requestDownload(
      currentResolved.directUrl,
      currentResolved.filename
    );

    if (response.ok) {
      downloadBtn.textContent = '✓ Sent to FDM / Browser';
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
});
