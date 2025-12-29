import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'OData Explorer & Visualizer',
    description: '自动检测并可视化 OData 服务。支持 XML/JSON 解析、图表展示及接管 OData 链接。',
    version: '1.0.2',
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open OData Explorer',
      default_popup: 'popup/index.html' 
    },
    // 背景脚本配置在 WXT 中通常是自动检测的，但为了明确 manifest
    background: {
      service_worker: 'entrypoints/background.ts',
    },
    web_accessible_resources: [
      {
        resources: ['viewer.html'],
        matches: ['<all_urls>'],
      },
    ],
  },
  modules: ['@wxt-dev/module-react'],
});