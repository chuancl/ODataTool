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
      
      // 使用当前 document 对象进行判断，比 innerText 更准确，特别是针对 XML
      const result = isODataPage(document, url);

      if (result.isOData) {
        console.log("[OData Visualizer] Detected:", result.type);
        
        const targetUrl = encodeURIComponent(url);
        const viewerUrl = browser.runtime.getURL(`/viewer.html?sourceType=url&url=${targetUrl}&detectedType=${result.type}`);
        
        // 使用 replace 避免历史记录堆叠，改善用户体验
        window.location.replace(viewerUrl);
      }
    }
  },
});