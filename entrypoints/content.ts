import { defineContentScript } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataPage, inferMetadataUrl, isValidODataMetadata } from '../services/odataService';
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

      // 1. 检查白名单
      const inWhitelist = isWhitelisted(url, settings.whitelist);
      
      // 2. 如果不在白名单且全局开关关闭，则直接退出
      if (!inWhitelist && !settings.enableGlobal) {
        return;
      }

      // 3. 执行检测
      checkAndTakeover(inWhitelist);
    }

    async function checkAndTakeover(forceTakeover: boolean) {
      const url = window.location.href;
      
      // ---------------------------------------------------------
      // 阶段 A: 被动检测 (分析当前页面 DOM 和 Content-Type)
      // ---------------------------------------------------------
      const result = isODataPage(document, url, forceTakeover);

      if (result.isOData) {
        console.log("[OData Visualizer] Passive Detection Success:", result.type);
        sendMessageAndRedirect(url, result.type);
        return;
      }

      // ---------------------------------------------------------
      // 阶段 B: 主动探测 (尝试拼接 $metadata)
      // ---------------------------------------------------------
      // 仅在以下情况尝试探测，避免对普通 HTML 网页发起无用请求:
      // 1. URL 包含 .svc (最明显的 OData 特征)
      // 2. Content-Type 是 XML, JSON 或 纯文本 (API 响应特征)
      // 3. 在白名单中 (强制尝试)
      const contentType = document.contentType;
      const isApiLikeContent = contentType.includes('xml') || contentType.includes('json') || contentType.includes('plain');
      const isSvcUrl = url.includes('.svc');

      if (forceTakeover || isSvcUrl || isApiLikeContent) {
          // 如果当前页面不是 HTML 页面 (排除 google.com 等)，或者 URL 很有可能是 OData
          if (!contentType.includes('html') || isSvcUrl) {
              await probeMetadata(url);
          }
      }
    }

    /**
     * 主动请求 $metadata 链接进行探测
     */
    async function probeMetadata(currentUrl: string) {
        const metadataUrl = inferMetadataUrl(currentUrl);
        
        // 如果推断出的 URL 和当前 URL 一样，且刚才被动检测失败了，就没必要再请求了
        if (metadataUrl === currentUrl) return;

        console.log("[OData Visualizer] Probing:", metadataUrl);

        try {
            const response = await fetch(metadataUrl, { method: 'GET', headers: { 'Accept': 'application/xml' } });
            if (response.ok) {
                const text = await response.text();
                if (isValidODataMetadata(text)) {
                    console.log("[OData Visualizer] Active Probe Success! Found Valid Metadata.");
                    // 成功探测到 Metadata，说明当前页面是一个 OData 服务的某个端点
                    // 我们重定向到 Viewer，Viewer 会自动根据 currentUrl 再次去抓 metadata 并进行分析
                    sendMessageAndRedirect(currentUrl, 'data'); // 既然有 metadata，说明当前页面可能是 data 或 service doc
                }
            }
        } catch (e) {
            // 探测失败是正常的，不做处理
            console.debug("[OData Visualizer] Probe failed:", e);
        }
    }

    function sendMessageAndRedirect(url: string, type: string) {
        const targetUrl = encodeURIComponent(url);
        browser.runtime.sendMessage({
          action: 'openViewer',
          url: targetUrl,
          detectedType: type
        }).catch(err => {
          console.warn("Failed to send message to background:", err);
        });
    }
  },
});