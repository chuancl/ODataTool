import { defineContentScript } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataPage } from '../services/odataService';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // 防止死循环：如果已经在插件页面，则不运行
    if (window.location.protocol === 'chrome-extension:') return;
    if ((window as any).__ODATA_CHECKED__) return;
    (window as any).__ODATA_CHECKED__ = true;

    checkAndTakeover();

    function checkAndTakeover() {
      const url = window.location.href;
      
      // 使用当前 document 对象进行判断
      const result = isODataPage(document, url);

      if (result.isOData) {
        console.log("[OData Visualizer] Detected:", result.type);
        
        const targetUrl = encodeURIComponent(url);
        
        // 修改：不要直接 window.location.replace，而是发消息给 background
        // 这样可以避免 "ERR_BLOCKED_BY_CLIENT" 错误
        browser.runtime.sendMessage({
          action: 'openViewer',
          url: targetUrl,
          detectedType: result.type
        }).catch(err => {
          // 忽略连接错误（例如插件更新导致旧 content script 失效）
          console.warn("Failed to send message to background:", err);
        });
      }
    }
  },
});