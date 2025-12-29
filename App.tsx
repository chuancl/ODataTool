import React, { useState } from 'react';
import { Database, FileUp, ArrowRight, Activity, Search } from 'lucide-react';
import { browser } from 'wxt/browser';

const App: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  
  const openViewer = async (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const viewerUrl = browser.runtime.getURL(`/viewer.html?${query}`);
    await browser.tabs.create({ url: viewerUrl });
  };

  const handleUrlParse = () => {
    if (!inputUrl) return;
    openViewer({ sourceType: 'url', url: inputUrl });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      // 将内容存入 storage，因为 URL 参数传大文本不合适
      await browser.storage.local.set({ 'temp_odata_content': content });
      openViewer({ sourceType: 'storage' });
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full h-full bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex items-center gap-2">
        <Database className="w-6 h-6" />
        <h1 className="font-bold text-lg">OData Explorer</h1>
      </header>

      <main className="flex-1 p-5 space-y-6">
        
        {/* URL 输入区域 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Search className="w-4 h-4" />
            解析在线 OData 服务
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="输入 URL (例如 .../$metadata)"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              onClick={handleUrlParse}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              解析
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            提示: 输入 $metadata 地址可获得最佳可视化效果。
          </p>
        </div>

        <div className="flex items-center justify-center text-slate-400 text-xs font-medium">
          - 或 -
        </div>

        {/* 文件上传区域 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            上传 Metadata 文件
          </label>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <p className="text-sm text-slate-500">点击上传 .xml 或 .edmx 文件</p>
            </div>
            <input type="file" className="hidden" accept=".xml,.edmx,.txt" onChange={handleFileUpload} />
          </label>
        </div>

        {/* 状态说明 */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
          <Activity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">自动检测已启用</p>
            <p>当您在浏览器中访问 OData XML 或 JSON 数据时，插件会自动提示或接管页面进行展示。</p>
          </div>
        </div>

      </main>

      <footer className="p-3 text-center text-xs text-slate-400">
        OData Visualizer v1.0
      </footer>
    </div>
  );
};

export default App;