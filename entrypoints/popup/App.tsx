import React, { useState } from 'react';
import { Database, FileUp, Activity, Search } from 'lucide-react';
import { browser } from 'wxt/browser';

const App: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  
  const openViewer = async (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    // 注意：这里的路径是相对于构建后的根目录，WXT 会把 entrypoints/viewer/index.html 映射到 /viewer.html
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
              placeholder="输入 URL"
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
             例如: http://services.odata.org/Northwind/Northwind.svc/
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

        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 items-start">
          <Activity className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            插件会自动接管 OData 服务链接。如果页面未自动跳转，请手动点击解析。
          </p>
        </div>

      </main>

      <footer className="p-3 text-center text-xs text-slate-400">
        OData Explorer v1.1
      </footer>
    </div>
  );
};

export default App;