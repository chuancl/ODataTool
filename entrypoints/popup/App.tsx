import React, { useState, useEffect } from 'react';
import { Database, FileUp, Activity, Search, Settings, Plus, Trash2, Power, ShieldCheck } from 'lucide-react';
import { browser } from 'wxt/browser';
import { AppSettings, DEFAULT_SETTINGS } from '../../types';
import { getSettings, saveSettings } from '../../services/storageService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [inputUrl, setInputUrl] = useState('');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [whitelistInput, setWhitelistInput] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const openViewer = async (params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const viewerUrl = (browser.runtime as any).getURL(`/viewer.html?${query}`);
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

  const addWhitelist = () => {
    if (!whitelistInput) return;
    const newList = [...settings.whitelist, whitelistInput];
    updateSetting('whitelist', newList);
    setWhitelistInput('');
  };

  const removeWhitelist = (index: number) => {
    const newList = [...settings.whitelist];
    newList.splice(index, 1);
    updateSetting('whitelist', newList);
  };

  return (
    <div className="w-full h-full bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Database className="w-6 h-6" />
           <h1 className="font-bold text-lg">OData Explorer</h1>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setActiveTab(activeTab === 'home' ? 'settings' : 'home')}
                className={`p-1.5 rounded-full transition ${activeTab === 'settings' ? 'bg-indigo-700' : 'hover:bg-indigo-500'}`}
                title="设置"
            >
                <Settings className="w-5 h-5" />
            </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'home' ? (
            <div className="p-5 space-y-6">
                {/* 快捷开关 */}
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${settings.enableGlobal ? 'bg-white border-green-200 shadow-sm' : 'bg-slate-100 border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${settings.enableGlobal ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                            <Power className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-700">自动检测</h3>
                            <p className="text-xs text-slate-500">{settings.enableGlobal ? '已开启' : '已暂停'}</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.enableGlobal} onChange={(e) => updateSetting('enableGlobal', e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                </div>

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
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition whitespace-nowrap"
                        >
                        解析
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-center text-slate-400 text-xs font-medium">- 或 -</div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <FileUp className="w-4 h-4" />
                        上传 Metadata 文件
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <p className="text-sm text-slate-500">点击上传 .xml / .edmx</p>
                        </div>
                        <input type="file" className="hidden" accept=".xml,.edmx,.txt" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>
        ) : (
            <div className="p-5 space-y-6">
                <div>
                    <h2 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        白名单管理
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">即便自动检测关闭，白名单内的网址仍会被插件自动接管。</p>
                    
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            placeholder="输入域名或关键字"
                            value={whitelistInput}
                            onChange={(e) => setWhitelistInput(e.target.value)}
                        />
                        <button onClick={addWhitelist} className="bg-indigo-100 text-indigo-700 p-2 rounded-lg hover:bg-indigo-200">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {settings.whitelist.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-sm italic bg-slate-100 rounded-lg border border-slate-200 border-dashed">
                                暂无白名单
                            </div>
                        )}
                        {settings.whitelist.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
                                <span className="truncate flex-1 font-mono text-slate-600">{item}</span>
                                <button onClick={() => removeWhitelist(idx)} className="text-slate-400 hover:text-red-500 ml-2">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      <footer className="p-3 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        OData Explorer v1.2
      </footer>
    </div>
  );
};

export default App;