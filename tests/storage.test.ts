import { describe, expect, it } from 'bun:test';
import { MAX_HISTORY_ITEMS } from '../src/storage/history';
import { DEFAULT_SETTINGS } from '../src/storage/settings';

describe('Storage & Settings', () => {
  it('verifies default settings match user privacy requirements', () => {
    expect(DEFAULT_SETTINGS.saveHistory).toBe(false); // Default OFF
    expect(DEFAULT_SETTINGS.autoPasteOnOpen).toBe(true);
    expect(DEFAULT_SETTINGS.autoDownloadOnResolve).toBe(false);
    expect(DEFAULT_SETTINGS.autoCopyOnResolve).toBe(false);
  });

  it('verifies max history capacity is capped at 8', () => {
    expect(MAX_HISTORY_ITEMS).toBe(8);
  });
});
