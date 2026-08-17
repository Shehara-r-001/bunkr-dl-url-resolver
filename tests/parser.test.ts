import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractFileId, extractFileName, extractJsCdn, sanitizeFilename } from '../src/providers/bunkr/parser';

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

  it('extracts filename and preserves extension from CDN url', () => {
    const filename1 = extractFileName(jsCdnHtml, 'https://cdn.example.com/media/clip.mp4');
    expect(filename1).toBe('Sample Video Clip.mp4');

    const filename2 = extractFileName(fallbackHtml, 'https://cdn.example.com/media/image.png');
    expect(filename2).toBe('Fallback Image Item.png');
  });

  it('sanitizes forbidden characters from filenames', () => {
    expect(sanitizeFilename('test/file:name*?.mp4')).toBe('test_file_name__.mp4');
    expect(sanitizeFilename('   leading and trailing .  ')).toBe('leading and trailing');
  });

  it('falls back to URL slug when HTML metadata is absent', () => {
    const filename = extractFileName('', 'https://cdn.example.com/storage/media/video123.mp4');
    expect(filename).toBe('video123.mp4');
  });
});
