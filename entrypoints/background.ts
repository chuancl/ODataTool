import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  console.log('OData Visualizer Background Script Initialized');

  // 监听来自 Content Script 的消息
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openViewer' && message.url) {
      const tabId = sender.tab?.id;
      if (tabId) {
        // 构建插件内部 Viewer 页面的 URL
        const viewerUrl = browser.runtime.getURL(
          `/viewer.html?sourceType=url&url=${message.url}&detectedType=${message.detectedType || 'unknown'}`
        );
        
        // 使用 update 方法让当前标签页跳转，这是权限最高的跳转方式，不会被页面 CSP 拦截
        browser.tabs.update(tabId, { url: viewerUrl });
      }
    }
  });
});