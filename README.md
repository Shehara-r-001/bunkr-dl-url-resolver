# Bunkr → FDM Resolver Extension

A lightweight, modern browser extension that resolves Bunkr download pages into signed temporary direct media URLs for **Free Download Manager (FDM)** and browser downloads.

![Icon](public/icon/128.png)

## Features

- **Direct Link Resolution**: Resolves intermediate Bunkr web pages (`dl.bunkr.*`, `bunkr.is`, etc.) to temporary CDN media URLs.
- **Dual Pipeline Support**:
  - Primary `jsCDN` extraction.
  - Fallback `_001_v2` API query for metadata-only pages.
  - Automatic URL signing via the CDN signing API.
- **FDM Integration**: Start downloads directly with one click to let Free Download Manager intercept them, or copy the direct URL with expiration info.
- **Privacy & Local Execution**: Fully client-side; no tracking, accounts, or proxy servers.

## Installation & Development

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)

### Setup

```bash
# Install dependencies
bun install

# Run dev server with hot reload
bun run dev

# Run unit tests
bun test

# Build production bundle
bun run build
```

### Loading in Browser (Chrome / Brave / Edge)

1. Run `bun run build`.
2. Open `chrome://extensions` in your Chromium browser.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the `.output/chrome-mv3` directory.

## License

[MIT](LICENSE)
