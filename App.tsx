import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, Play, RotateCcw, Save, Languages, Loader2 } from 'lucide-react';
// Fix: Import browser API from wxt/browser to fix 'chrome' namespace errors
import { browser } from 'wxt/browser';
import { UserSettings } from './types';

// Mock storage for development in browser environment, in real extension use chrome.storage
const loadSettings = (): UserSettings => {
  const saved = localStorage.getItem('immersion_settings');
  return saved ? JSON.parse(saved) : {
    apiKey: '',
    difficulty: 'intermediate',
    immersionRate: 30,
    customVocabulary: []
  };
};

const saveSettings = (settings: UserSettings) => {
  localStorage.setItem('immersion_settings', JSON.stringify(settings));
  // In WXT/Chrome Extension:
  // browser.storage.sync.set(settings);
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(loadSettings());
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [vocabInput, setVocabInput] = useState('');

  useEffect(() => {
    // Load settings on mount
    const s = loadSettings();
    setSettings(s);
  }, []);

  const handleSaveSettings = () => {
    saveSettings(settings);
    setStatusMessage('Settings saved!');
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const handleStartImmersion = async () => {
    if (!settings.apiKey) {
      setStatusMessage('Please set API Key in settings first.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Analyzing page content...');

    try {
      // In a real extension, we query the active tab
      // Fix: Use browser.tabs.query instead of chrome.tabs.query
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send message to content script
        // Fix: Use browser.tabs.sendMessage instead of chrome.tabs.sendMessage
        await browser.tabs.sendMessage(tab.id, { 
          type: 'START_IMMERSION', 
          settings: settings 
        });
        setStatusMessage('Immersion active!');
      } else {
        setStatusMessage('No active tab found.');
      }
    } catch (e) {
      console.error(e);
      // Fallback for local development testing (no chrome API)
      setStatusMessage('Extension environment not detected. (Check console)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    try {
      // Fix: Use browser.tabs.query instead of chrome.tabs.query
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Fix: Use browser.tabs.sendMessage instead of chrome.tabs.sendMessage
        await browser.tabs.sendMessage(tab.id, { type: 'RESET_PAGE' });
        setStatusMessage('Page reset.');
      }
    } catch (e) {
      setStatusMessage('Could not reset page.');
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
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h1 className="font-bold text-lg">Context Immersion</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`p-2 rounded-full hover:bg-blue-500 transition ${activeTab === 'home' ? 'bg-blue-700' : ''}`}
          >
            <Languages className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-full hover:bg-blue-500 transition ${activeTab === 'settings' ? 'bg-blue-700' : ''}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {statusMessage && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium animate-pulse">
            {statusMessage}
          </div>
        )}

        {activeTab === 'home' ? (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-2 text-slate-700">Active Learning</h2>
              <p className="text-sm text-slate-500 mb-4">
                Replace Chinese text on the current page with English based on your settings.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStartImmersion}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {isProcessing ? 'Immersing...' : 'Start Immersion'}
                </button>

                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Page
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-slate-700">Vocabulary Focus</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{settings.customVocabulary.length} words</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={vocabInput}
                  onChange={(e) => setVocabInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addVocabWord()}
                  placeholder="Add target word..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button 
                  onClick={addVocabWord}
                  className="bg-slate-800 text-white px-3 py-2 rounded-md hover:bg-slate-700"
                >
                  Add
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
                  <p className="text-xs text-slate-400 italic">No custom words added yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
             <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 text-slate-700">Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    placeholder="Enter your Google GenAI API Key"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Key is stored locally in your browser.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty Level</label>
                  <select
                    value={settings.difficulty}
                    onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="beginner">Beginner (Simple words)</option>
                    <option value="intermediate">Intermediate (Phrases/Idioms)</option>
                    <option value="advanced">Advanced (Complex/Academic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Immersion Rate: {settings.immersionRate}%
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
                    <span>Subtle</span>
                    <span>Intense</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition shadow-sm"
            >
              <Save className="w-5 h-5" />
              Save Settings
            </button>
          </div>
        )}
      </main>
      
      <footer className="bg-slate-50 p-3 text-center text-xs text-slate-400 border-t border-slate-200">
        Powered by Google Gemini 2.5 Flash
      </footer>
    </div>
  );
};

export default App;