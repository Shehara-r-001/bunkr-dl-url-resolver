/**
 * Extracts the inline jsCDN string from Bunkr page HTML.
 */
export function extractJsCdn(html: string): string | null {
  if (!html) return null;

  // Patterns for jsCDN in script tags
  const patterns = [
    /(?:var|let|const|window\.)?\s*jsCDN\s*[:=]\s*["']([^"']+)["']/i,
    /"jsCDN"\s*:\s*["']([^"']+)["']/i,
    /var\s+server\s*=\s*["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const raw = match[1].trim();
      // Unescape forward slashes e.g. "https:\/\/cdn..."
      const cleaned = raw.replace(/\\\//g, '/');
      if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
        return cleaned;
      }
    }
  }

  return null;
}

/**
 * Extracts data-file-id from HTML for fallback API resolution.
 */
export function extractFileId(html: string): string | null {
  if (!html) return null;

  const patterns = [
    /data-file-id\s*=\s*["']([^"']+)["']/i,
    /data-id\s*=\s*["']([^"']+)["']/i,
    /data-file\s*=\s*["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const id = match[1].trim();
      if (id.length > 0) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Strips invalid filesystem characters from filename.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts human-readable filename from page HTML or falls back to URL slug.
 */
export function extractFileName(html: string, fallbackUrl?: string): string {
  if (html) {
    // Check <h1 class="..."> or <h1 id="...">
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match?.[1]) {
      const text = h1Match[1].replace(/<[^>]+>/g, '').trim();
      if (text && !text.toLowerCase().includes('bunkr')) {
        return sanitizeFilename(text);
      }
    }

    // Check <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]) {
      const title = titleMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\|?\s*Bunkr.*$/i, '')
        .replace(/-?\s*Bunkr.*$/i, '')
        .trim();
      if (title) {
        return sanitizeFilename(title);
      }
    }
  }

  if (fallbackUrl) {
    try {
      const url = new URL(fallbackUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          return sanitizeFilename(decodeURIComponent(lastPart));
        }
      }
    } catch {
      // ignore
    }
  }

  return 'download';
}
