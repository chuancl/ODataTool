import { defineContentScript } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataMetadata, isODataJson } from '../services/odataService';

export default defineContentScript({
  matches: ['<all_urls>'],
  // 在文档加载完成后运行，以便获取完整的 DOM
  runAt: 'document_idle',
  main() {
    // 简单的防抖，避免重复执行
    if ((window as any).__ODATA_CHECKED__) return;
    (window as any).__ODATA_CHECKED__ = true;

    checkAndTakeover();

    function checkAndTakeover() {
      const url = window.location.href;
      
      // 1. 检查 URL 特征 (最快)
      const looksLikeODataUrl = url.includes('$metadata');

      // 2. 检查内容特征 (更准确)
      // 获取页面纯文本内容（针对 Chrome 显示 XML/JSON 的情况）
      let content = document.body ? document.body.innerText : '';
      // 如果是 view-source 或者是某些 XML 渲染模式，可能需要处理
      if (!content && document.documentElement) {
        content = document.documentElement.outerHTML;
      }

      const isMetadata = isODataMetadata(content);
      const isJsonData = isODataJson(content);

      if (isMetadata || isJsonData || looksLikeODataUrl) {
        console.log("OData Service Detected!");
        injectTakeoverUI(isMetadata ? 'metadata' : 'data');
      }
    }

    function injectTakeoverUI(type: 'metadata' | 'data') {
      // 创建一个全屏覆盖层或顶部横幅
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: #f0f9ff;
        border-bottom: 1px solid #bae6fd;
        color: #0369a1;
        padding: 12px 20px;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      `;

      const text = document.createElement('span');
      text.innerHTML = `<strong>OData 检测到:</strong> 看起来这是一个 OData ${type === 'metadata' ? '元数据定义' : '数据响应'}。`;
      
      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '10px';

      const btn = document.createElement('button');
      btn.textContent = '使用可视化工具查看';
      btn.style.cssText = `
        background-color: #0284c7;
        color: white;
        border: none;
        padding: 6px 16px;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      btn.onmouseover = () => btn.style.backgroundColor = '#0369a1';
      btn.onmouseout = () => btn.style.backgroundColor = '#0284c7';
      
      btn.onclick = () => {
        const viewerUrl = browser.runtime.getURL(`/viewer.html?sourceType=url&url=${encodeURIComponent(window.location.href)}`);
        window.location.href = viewerUrl;
      };

      // 关闭按钮
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        font-size: 16px;
        margin-left: 10px;
      `;
      closeBtn.onclick = () => banner.remove();

      btnGroup.appendChild(btn);
      btnGroup.appendChild(closeBtn);
      banner.appendChild(text);
      banner.appendChild(btnGroup);

      document.body.prepend(banner);

      // 如果非常确定是 $metadata，可以考虑自动跳转，但为了不打扰用户，Banner 更好
      // 如果需要强力接管，取消注释下面这行：
      // if (type === 'metadata') btn.click();
    }
  },
});
