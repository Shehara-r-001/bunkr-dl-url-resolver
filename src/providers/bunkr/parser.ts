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
 * Strips invalid filesystem characters and trims leading/trailing dots/spaces.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\x00-\x1f\x7f-\x9f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .trim();

  return cleaned || 'download';
}

/**
 * Extracts human-readable filename from page HTML or falls back to URL slug,
 * ensuring file extensions from CDN URLs are preserved.
 */
export function extractFileName(html: string, fallbackUrl?: string): string {
  let name = '';
  let urlExt = '';

  // Extract extension and fallback name from URL
  if (fallbackUrl) {
    try {
      const url = new URL(fallbackUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          const decoded = decodeURIComponent(lastPart);
          const match = decoded.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
          if (match) {
            urlExt = `.${match[1]}`;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Priority 1: <h1> in page HTML
  if (html) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match?.[1]) {
      const text = h1Match[1].replace(/<[^>]+>/g, '').trim();
      if (text && !text.toLowerCase().includes('bunkr')) {
        name = text;
      }
    }

    // Priority 2: <title> in page HTML
    if (!name) {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) {
        const title = titleMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\|?\s*Bunkr.*$/i, '')
          .replace(/-?\s*Bunkr.*$/i, '')
          .trim();
        if (title) {
          name = title;
        }
      }
    }
  }

  // Priority 3: Slug from URL
  if (!name && fallbackUrl) {
    try {
      const url = new URL(fallbackUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const segment = parts[parts.length - 1];
        if (segment) {
          name = decodeURIComponent(segment);
        }
      }
    } catch {
      // ignore
    }
  }

  let finalName = sanitizeFilename(name || 'download');

  // Ensure file has an extension if one was found on the CDN URL
  if (urlExt && !/\.[a-zA-Z0-9]{2,5}$/i.test(finalName)) {
    finalName = `${finalName}${urlExt}`;
  }

  return finalName;
}
