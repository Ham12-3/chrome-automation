import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Browser Automation Bridge',
    description: 'Cross-browser automation bridge for AI assistants',
    version: '0.1.0',
    permissions: [
      'tabs',
      'activeTab',
      'storage',
      'scripting',
      'bookmarks',
      'history',
      'alarms',
      'webNavigation',
    ],
    host_permissions: ['<all_urls>'],
    manifest_version: 3,
  },
});
