import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Bunkr → FDM Resolver',
    description: 'Resolve Bunkr file links into direct temporary media URLs for Free Download Manager',
    version: '0.1.0',
    permissions: [
      'downloads',
      'storage',
      'clipboardRead',
      'contextMenus',
      'notifications'
    ],
    host_permissions: [
      'https://*.bunkr.cr/*',
      'https://*.bunkr.site/*',
      'https://*.bunkr.is/*',
      'https://*.bunkr.to/*',
      'https://*.bunkr.ru/*',
      'https://*.bunkr.ws/*',
      'https://*.bunkr.se/*',
      'https://*.bunkr.la/*',
      'https://*.bunkr.black/*',
      'https://*.bunkr.red/*',
      'https://*.bunkr.media/*',
      'https://*.bunkr.ac/*',
      'https://*.bunkr.ph/*',
      'https://*.bunkr.pk/*',
      'https://*.bunkr.ps/*',
      'https://*.bunkr.si/*',
      'https://*.bunkr.fi/*',
      'https://*.bunkr.ax/*',
      'https://*.bunkr.cat/*',
      'https://*.bunkr.team/*',
      'https://*.bunkr.nl/*',
      'https://*.bunkr.ci/*',
      'https://*.bunkr.sk/*',
      'https://*.bunkr.nu/*',
      'https://glb-apisign.cdn.cr/*'
    ]
  }
});
