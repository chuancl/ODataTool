import { defineContentScript } from 'wxt/sandbox';
// 修复：从 wxt/browser 导入 browser API 以解决 'chrome' 命名空间错误
import { browser } from 'wxt/browser';
import { analyzeTextForImmersion } from '../services/geminiService';
import { UserSettings, ExtensionMessage } from '../types';

// 我们无法直接导入包含密钥的服务，但在这个演示中，
// analyzeTextForImmersion 函数现在是一个本地逻辑，不包含敏感密钥。
// 注意：在生产环境中，API 调用通常应通过后台脚本 (background script) 代理以避免 CORS 问题，
// 但 Chrome Extensions V3 允许在配置了 host permissions 的情况下从内容脚本发起 fetch。

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Context Immersion Content Script Loaded (中文版)');

    // 存储原始 HTML 以便重置
    let originalBodyHTML: string | null = null;

    // 修复：使用 browser.runtime.onMessage 代替 chrome.runtime.onMessage
    browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      const msg = message as ExtensionMessage;
      if (msg.type === 'START_IMMERSION') {
        if (!originalBodyHTML) {
          originalBodyHTML = document.body.innerHTML;
        }
        processPage(msg.settings);
      } else if (msg.type === 'RESET_PAGE') {
        if (originalBodyHTML) {
          document.body.innerHTML = originalBodyHTML;
          originalBodyHTML = null;
        }
      }
    });

    async function processPage(settings: UserSettings) {
      // 1. 有效地识别文本节点
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // 跳过 script, style 和隐藏元素
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.textContent?.trim().length === 0) {
              return NodeFilter.FILTER_REJECT;
            }
            // 简单的中文检查
            if (!/[\u4e00-\u9fa5]/.test(node.textContent || '')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes: Node[] = [];
      let currentNode = walker.nextNode();
      while (currentNode) {
        textNodes.push(currentNode);
        currentNode = walker.nextNode();
      }

      // 2. 优化：仅处理前 N 个节点以节省性能（演示用）
      // 这里我们只处理前 5 个重要的文本块
      const nodesToProcess = textNodes.slice(0, 5); 

      // 在页面上显示加载指示器（可选）
      const loader = document.createElement('div');
      loader.innerText = '正在融入英语...';
      loader.style.cssText = 'position:fixed;top:10px;right:10px;background:#2563eb;color:white;padding:10px;border-radius:5px;z-index:9999;font-family:sans-serif;';
      document.body.appendChild(loader);

      for (const node of nodesToProcess) {
        const originalText = node.textContent || '';
        
        try {
          // 调用服务进行分析
          // 注意：这在页面上下文中运行。
          const replacements = await analyzeTextForImmersion(originalText, settings);

          if (replacements && replacements.length > 0) {
            replaceTextInNode(node, originalText, replacements);
          }
        } catch (err) {
          console.error("处理节点时出错:", err);
        }
      }

      loader.remove();
    }

    function replaceTextInNode(node: Node, originalText: string, replacements: {original: string, replacement: string}[]) {
      const parent = node.parentElement;
      if (!parent) return;

      let html = originalText;
      
      // 按长度降序排序，以避免部分替换问题
      replacements.sort((a, b) => b.original.length - a.original.length);

      replacements.forEach(item => {
        // 对原始字符串中的正则特殊字符进行转义
        const escapedOriginal = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedOriginal, 'g');
        
        // 带有工具提示的样式化替换
        const replacementHTML = `
          <span 
            class="immersion-highlight" 
            style="color: #2563eb; font-weight: 500; cursor: help; border-bottom: 1px dashed #2563eb;" 
            title="原文: ${item.original}"
          >${item.replacement}</span>
        `;
        
        html = html.replace(regex, replacementHTML);
      });

      // 如果发生了更改，则更新 DOM
      if (html !== originalText) {
        const span = document.createElement('span');
        span.innerHTML = html;
        parent.replaceChild(span, node);
      }
    }
  },
});