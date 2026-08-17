import { describe, expect, it } from 'bun:test';
import { isBunkrHost, parseAndValidateBunkrUrl } from '../src/providers/bunkr/urls';

describe('Bunkr URLs', () => {
  it('identifies valid Bunkr hosts', () => {
    expect(isBunkrHost('bunkr.cr')).toBe(true);
    expect(isBunkrHost('dl.bunkr.cr')).toBe(true);
    expect(isBunkrHost('stream.bunkr.is')).toBe(true);
    expect(isBunkrHost('bunkr.site')).toBe(true);
    expect(isBunkrHost('bunkr.black')).toBe(true);
    expect(isBunkrHost('bunkr.red')).toBe(true);
    expect(isBunkrHost('bunkrr.su')).toBe(true);
  });

  it('rejects unsupported hosts', () => {
    expect(isBunkrHost('example.com')).toBe(false);
    expect(isBunkrHost('google.com')).toBe(false);
    expect(isBunkrHost('bunkr.fake.com')).toBe(false);
  });

  it('parses valid URLs with or without protocol', () => {
    const url1 = parseAndValidateBunkrUrl('https://dl.bunkr.cr/file/xyz');
    expect(url1.hostname).toBe('dl.bunkr.cr');
    expect(url1.pathname).toBe('/file/xyz');

    const url2 = parseAndValidateBunkrUrl('bunkr.is/v/test-video');
    expect(url2.hostname).toBe('bunkr.is');
    expect(url2.pathname).toBe('/v/test-video');
  });

  it('throws on invalid or non-bunkr URLs', () => {
    expect(() => parseAndValidateBunkrUrl('')).toThrow();
    expect(() => parseAndValidateBunkrUrl('https://youtube.com/watch?v=123')).toThrow();
  });
});
