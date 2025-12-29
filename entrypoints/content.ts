import { defineContentScript } from 'wxt/sandbox';
// Fix: Import browser API from wxt/browser to fix 'chrome' namespace errors
import { browser } from 'wxt/browser';
import { analyzeTextForImmersion } from '../services/geminiService';
import { UserSettings, ExtensionMessage } from '../types';

// We cannot import the service directly if it uses secrets, but for this demo 
// we assume the key is passed via message or stored in chrome.storage.
// However, 'analyzeTextForImmersion' runs in the content script context here.
// NOTE: In production, API calls should often be proxied through background script to avoid CORS,
// but Chrome Extensions V3 allow fetch from content scripts if host permissions are set.

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Context Immersion Content Script Loaded');

    // Store original HTML to allow reset
    let originalBodyHTML: string | null = null;

    // Fix: Use browser.runtime.onMessage instead of chrome.runtime.onMessage
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
      // 1. Identify text nodes effectively
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip script, style, and hidden elements
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.textContent?.trim().length === 0) {
              return NodeFilter.FILTER_REJECT;
            }
            // Simple check for Chinese characters
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

      // 2. Optimization: Only process visible nodes or top N nodes to save tokens
      // For this demo, let's process the first 5 significant chunks
      const nodesToProcess = textNodes.slice(0, 5); 

      // Show a loading indicator on the page (optional)
      const loader = document.createElement('div');
      loader.innerText = 'Immersing English...';
      loader.style.cssText = 'position:fixed;top:10px;right:10px;background:#2563eb;color:white;padding:10px;border-radius:5px;z-index:9999;';
      document.body.appendChild(loader);

      for (const node of nodesToProcess) {
        const originalText = node.textContent || '';
        
        try {
          // Call Gemini Service
          // NOTE: This runs in the context of the page. 
          // Ensure host_permissions allow access to Gemini API or proxy via background.
          const replacements = await analyzeTextForImmersion(originalText, settings);

          if (replacements && replacements.length > 0) {
            replaceTextInNode(node, originalText, replacements);
          }
        } catch (err) {
          console.error("Error processing node:", err);
        }
      }

      loader.remove();
    }

    function replaceTextInNode(node: Node, originalText: string, replacements: {original: string, replacement: string}[]) {
      const parent = node.parentElement;
      if (!parent) return;

      let html = originalText;
      
      // Sort replacements by length desc to avoid partial replacement issues
      replacements.sort((a, b) => b.original.length - a.original.length);

      replacements.forEach(item => {
        // Escape regex special chars in the original string
        const escapedOriginal = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedOriginal, 'g');
        
        // Styled replacement with tooltip
        const replacementHTML = `
          <span 
            class="immersion-highlight" 
            style="color: #2563eb; font-weight: 500; cursor: help; border-bottom: 1px dashed #2563eb;" 
            title="Original: ${item.original}"
          >${item.replacement}</span>
        `;
        
        html = html.replace(regex, replacementHTML);
      });

      // If changes occurred, update DOM
      if (html !== originalText) {
        const span = document.createElement('span');
        span.innerHTML = html;
        parent.replaceChild(span, node);
      }
    }
  },
});