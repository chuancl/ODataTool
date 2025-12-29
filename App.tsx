import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, Play, RotateCcw, Save, Languages, Loader2 } from 'lucide-react';
// 修复：从 wxt/browser 导入 browser API 以解决 'chrome' 命名空间错误
import { browser } from 'wxt/browser';
import { UserSettings } from './types';

// 在浏览器环境中模拟存储，在实际扩展中使用 browser.storage
const loadSettings = (): UserSettings => {
  const saved = localStorage.getItem('immersion_settings');
  return saved ? JSON.parse(saved) : {
    difficulty: 'intermediate',
    immersionRate: 30,
    customVocabulary: []
  };
};

const saveSettings = (settings: UserSettings) => {
  localStorage.setItem('immersion_settings', JSON.stringify(settings));
  // 在 WXT/Chrome 扩展中：
  // browser.storage.sync.set(settings);
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(loadSettings());
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [vocabInput, setVocabInput] = useState('');

  useEffect(() => {
    // 组件加载时读取设置
    const s = loadSettings();
    setSettings(s);
  }, []);

  const handleSaveSettings = () => {
    saveSettings(settings);
    setStatusMessage('设置已保存！');
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleStartImmersion = async () => {
    setIsProcessing(true);
    setStatusMessage('正在分析页面内容...');

    try {
      // 在实际扩展中，查询当前活动标签页
      // 修复：使用 browser.tabs.query 代替 chrome.tabs.query
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // 发送消息给内容脚本 (content script)
        // 修复：使用 browser.tabs.sendMessage 代替 chrome.tabs.sendMessage
        await browser.tabs.sendMessage(tab.id, { 
          type: 'START_IMMERSION', 
          settings: settings 
        });
        setStatusMessage('沉浸模式已激活！');
      } else {
        setStatusMessage('未找到活动标签页。');
      }
    } catch (e) {
      console.error(e);
      // 本地开发测试的回退提示
      setStatusMessage('未检测到扩展环境。(请查看控制台)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    try {
      // 修复：使用 browser.tabs.query 代替 chrome.tabs.query
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // 修复：使用 browser.tabs.sendMessage 代替 chrome.tabs.sendMessage
        await browser.tabs.sendMessage(tab.id, { type: 'RESET_PAGE' });
        setStatusMessage('页面已重置。');
      }
    } catch (e) {
      setStatusMessage('无法重置页面。');
    }
  };

  const addVocabWord = () => {
    if (vocabInput.trim()) {
      const newVocab = [...settings.customVocabulary, vocabInput.trim()];
      setSettings({ ...settings, customVocabulary: newVocab });
      setVocabInput('');
    }
  };

  const removeVocabWord = (word: string) => {
    const newVocab = settings.customVocabulary.filter(w => w !== word);
    setSettings({ ...settings, customVocabulary: newVocab });
  };

  return (
    <div className="w-full h-full min-h-[500px] bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 头部导航 */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h1 className="font-bold text-lg">沉浸式英语</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`p-2 rounded-full hover:bg-blue-500 transition ${activeTab === 'home' ? 'bg-blue-700' : ''}`}
            title="主页"
          >
            <Languages className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-full hover:bg-blue-500 transition ${activeTab === 'settings' ? 'bg-blue-700' : ''}`}
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 主要内容区 */}
      <main className="flex-1 p-4 overflow-y-auto">
        {statusMessage && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium animate-pulse">
            {statusMessage}
          </div>
        )}

        {activeTab === 'home' ? (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-2 text-slate-700">主动学习</h2>
              <p className="text-sm text-slate-500 mb-4">
                根据您的设置，将当前页面上的中文文本替换为英文。
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStartImmersion}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {isProcessing ? '正在处理...' : '开始沉浸'}
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置页面
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-slate-700">重点词汇</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{settings.customVocabulary.length} 个词</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={vocabInput}
                  onChange={(e) => setVocabInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addVocabWord()}
                  placeholder="添加目标单词..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button 
                  onClick={addVocabWord}
                  className="bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-700"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {settings.customVocabulary.map((word, idx) => (
                  <span key={idx} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md flex items-center gap-1 border border-slate-200">
                    {word}
                    <button onClick={() => removeVocabWord(word)} className="text-slate-400 hover:text-red-500 font-bold">×</button>
                  </span>
                ))}
                {settings.customVocabulary.length === 0 && (
                  <p className="text-xs text-slate-400 italic">暂无自定义单词。</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 text-slate-700">配置</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">难度等级</label>
                  <select
                    value={settings.difficulty}
                    onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="beginner">初级 (简单词汇)</option>
                    <option value="intermediate">中级 (短语/习语)</option>
                    <option value="advanced">高级 (复杂/学术)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    沉浸率: {settings.immersionRate}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={settings.immersionRate}
                    onChange={(e) => setSettings({ ...settings, immersionRate: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>轻度</span>
                    <span>深度</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition shadow-sm"
            >
              <Save className="w-5 h-5" />
              保存设置
            </button>
          </div>
        )}
      </main>
      
      <footer className="bg-slate-50 p-3 text-center text-xs text-slate-400 border-t border-slate-200">
        Powered by Context Immersion
      </footer>
    </div>
  );
};

export default App;