import { describe, expect, it } from 'bun:test';
import { extractUrlFromMenuClick } from '../src/context-menu/menu';

describe('Context Menu URL Extraction', () => {
  it('extracts valid Bunkr URL from linkUrl', () => {
    const info = {
      menuItemId: 'bunkr-fdm-download',
      editable: false,
      linkUrl: 'https://dl.bunkr.cr/file/test-id-123'
    } as chrome.contextMenus.OnClickData;

    const extracted = extractUrlFromMenuClick(info);
    expect(extracted).toBe('https://dl.bunkr.cr/file/test-id-123');
  });

  it('extracts valid Bunkr URL from selectionText', () => {
    const info = {
      menuItemId: 'bunkr-fdm-download',
      editable: false,
      selectionText: '  bunkr.is/v/my-clip  '
    } as chrome.contextMenus.OnClickData;

    const extracted = extractUrlFromMenuClick(info);
    expect(extracted).toBe('https://bunkr.is/v/my-clip');
  });

  it('returns null for non-Bunkr links or arbitrary text', () => {
    const info1 = {
      menuItemId: 'bunkr-fdm-download',
      editable: false,
      linkUrl: 'https://google.com/search?q=test'
    } as chrome.contextMenus.OnClickData;

    expect(extractUrlFromMenuClick(info1)).toBeNull();

    const info2 = {
      menuItemId: 'bunkr-fdm-download',
      editable: false,
      selectionText: 'hello world random text'
    } as chrome.contextMenus.OnClickData;

    expect(extractUrlFromMenuClick(info2)).toBeNull();
  });
});
