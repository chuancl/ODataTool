import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'OData Explorer & Visualizer',
    description: '自动检测并可视化 OData 服务。支持 XML/JSON 解析、图表展示及接管 OData 链接。',
    version: '1.0.1',
    permissions: ['activeTab', 'storage', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Open OData Explorer',
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