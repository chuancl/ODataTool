import { defineContentScript } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataContent } from '../services/odataService';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    if ((window as any).__ODATA_CHECKED__) return;
    (window as any).__ODATA_CHECKED__ = true;

    // 排除扩展自身的页面，防止死循环 (虽然 <all_urls> 通常不包含 chrome-extension://)
    if (window.location.protocol === 'chrome-extension:') return;

    checkAndTakeover();

    function checkAndTakeover() {
      const url = window.location.href;
      
      // 获取页面内容用于检测
      let content = document.body ? document.body.innerText : '';
      if (!content && document.documentElement) {
        content = document.documentElement.outerHTML;
      }
      
      // 有些 XML 页面 Chrome 会用 embedded viewer，导致 innerText 只有显示文本
      // 尝试获取原始 XML 字符串如果可能（对于 content script 比较难，只能依赖 outerHTML）
      // 如果页面还是 loading 状态，可能获取不到完整内容，但 runAt document_idle 应该可以

      const result = isODataContent(content, url);

      if (result.isOData) {
        console.log("OData Service Detected:", result.type);
        
        // 构建 Viewer URL
        const targetUrl = encodeURIComponent(url);
        // 如果检测到是 OData，直接跳转接管
        // 传递 detectedType 参数帮助 Viewer 决定如何处理
        const viewerUrl = browser.runtime.getURL(`/viewer.html?sourceType=url&url=${targetUrl}&detectedType=${result.type}`);
        
        // 立即重定向
        window.location.replace(viewerUrl);
      }
    }
  },
});