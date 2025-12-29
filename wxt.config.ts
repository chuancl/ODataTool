import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Context-Immersion Learning',
    description: 'Learn English by immersing vocabulary into your daily browsing.',
    version: '1.0.0',
    permissions: ['activeTab', 'storage', 'scripting'],
    action: {
      default_title: 'Open Context-Immersion',
    },
  },
  modules: ['@wxt-dev/module-react'],
});