import { defineContentScript } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataPage } from '../services/odataService';
import { getSettings, isWhitelisted } from '../services/storageService';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // 防止死循环
    if (window.location.protocol === 'chrome-extension:') return;
    if ((window as any).__ODATA_CHECKED__) return;
    (window as any).__ODATA_CHECKED__ = true;

    init();

    async function init() {
      const settings = await getSettings();
      const url = window.location.href;

      // 1. 检查白名单 (优先级最高，即使全局关闭也生效)
      const inWhitelist = isWhitelisted(url, settings.whitelist);
      
      // 2. 如果不在白名单且全局开关关闭，则直接退出
      if (!inWhitelist && !settings.enableGlobal) {
        return;
      }

      // 3. 执行检测
      checkAndTakeover(inWhitelist);
    }

    function checkAndTakeover(forceTakeover: boolean) {
      const url = window.location.href;
      
      // 如果在白名单中，我们放宽检测标准，只要有点像 XML/JSON 就尝试接管
      // 否则使用严格检测
      const result = isODataPage(document, url, forceTakeover);

      if (result.isOData) {
        console.log("[OData Visualizer] Detected:", result.type);
        
        const targetUrl = encodeURIComponent(url);
        
        browser.runtime.sendMessage({
          action: 'openViewer',
          url: targetUrl,
          detectedType: result.type
        }).catch(err => {
          console.warn("Failed to send message to background:", err);
        });
      }
    }
  },
});