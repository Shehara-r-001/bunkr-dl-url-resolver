export interface UserSettings {
  saveHistory: boolean;
  autoDownloadOnResolve: boolean;
  autoCopyOnResolve: boolean;
  autoPasteOnOpen: boolean;
  downloadMethod: 'download' | 'new_tab';
}

export const DEFAULT_SETTINGS: UserSettings = {
  saveHistory: false, // Default to no save as requested
  autoDownloadOnResolve: false,
  autoCopyOnResolve: false,
  autoPasteOnOpen: true,
  downloadMethod: 'download'
};

const SETTINGS_KEY = 'bunkr_fdm_settings';

export async function loadSettings(): Promise<UserSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([SETTINGS_KEY], (result) => {
        if (chrome.runtime.lastError || !result[SETTINGS_KEY]) {
          // Fallback to local storage if sync not available
          chrome.storage.local.get([SETTINGS_KEY], (localResult) => {
            resolve({
              ...DEFAULT_SETTINGS,
              ...(localResult[SETTINGS_KEY] || {})
            });
          });
        } else {
          resolve({
            ...DEFAULT_SETTINGS,
            ...result[SETTINGS_KEY]
          });
        }
      });
    });
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await loadSettings();
  const updated: UserSettings = {
    ...current,
    ...settings
  };

  if (typeof chrome !== 'undefined' && chrome.storage) {
    await new Promise<void>((resolve) => {
      chrome.storage.sync.set({ [SETTINGS_KEY]: updated }, () => {
        chrome.storage.local.set({ [SETTINGS_KEY]: updated }, () => {
          resolve();
        });
      });
    });
  }

  return updated;
}
