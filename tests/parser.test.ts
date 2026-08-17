import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractFileId, extractFileName, extractJsCdn } from '../src/providers/bunkr/parser';

describe('Bunkr HTML Parser', () => {
  const jsCdnHtml = readFileSync(join(__dirname, 'fixtures/js-cdn-page.html'), 'utf-8');
  const fallbackHtml = readFileSync(join(__dirname, 'fixtures/fallback-page.html'), 'utf-8');

  it('extracts jsCDN from inline script', () => {
    const cdnUrl = extractJsCdn(jsCdnHtml);
    expect(cdnUrl).toBe('https://media-cdn.bunkr.is/storage/media/sample-video-clip.mp4');
  });

  it('extracts data-file-id from fallback script', () => {
    const fileId = extractFileId(fallbackHtml);
    expect(fileId).toBe('abc123xyz');
  });

  it('extracts filename from HTML headers or titles', () => {
    const filename1 = extractFileName(jsCdnHtml);
    expect(filename1).toBe('Sample Video Clip');

    const filename2 = extractFileName(fallbackHtml);
    expect(filename2).toBe('Fallback Image Item');
  });

  it('falls back to URL slug when HTML metadata is absent', () => {
    const filename = extractFileName('', 'https://cdn.example.com/storage/media/video123.mp4');
    expect(filename).toBe('video123.mp4');
  });
});
