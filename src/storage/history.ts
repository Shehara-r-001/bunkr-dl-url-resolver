import { loadSettings } from './settings';

export interface HistoryItem {
  id: string;
  sourceUrl: string;
  filename: string;
  timestamp: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export const MAX_HISTORY_ITEMS = 8;
const HISTORY_KEY = 'bunkr_fdm_history';

export async function getHistory(): Promise<HistoryItem[]> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([HISTORY_KEY], (result) => {
        if (chrome.runtime.lastError || !result[HISTORY_KEY]) {
          resolve([]);
        } else {
          resolve(result[HISTORY_KEY] as HistoryItem[]);
        }
      });
    });
  }
  return [];
}

export async function addHistoryItem(
  item: Omit<HistoryItem, 'id' | 'timestamp'>
): Promise<HistoryItem[]> {
  const settings = await loadSettings();
  if (!settings.saveHistory) {
    return getHistory();
  }

  const current = await getHistory();
  const newItem: HistoryItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now()
  };

  // Filter duplicate recent entries for the same source URL
  const filtered = current.filter((h) => h.sourceUrl !== item.sourceUrl);
  const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [HISTORY_KEY]: updated }, () => {
        resolve();
      });
    });
  }

  return updated;
}

export async function clearHistory(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove([HISTORY_KEY], () => {
        resolve();
      });
    });
  }
}
