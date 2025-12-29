import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Box, Layers, ArrowRight, RefreshCw, Code, Database } from 'lucide-react';
import { ViewerState } from '../../types';
import { parseODataMetadata } from '../../services/odataService';

const ODataViewerApp: React.FC = () => {
  const [state, setState] = useState<ViewerState>({
    sourceType: 'raw',
    isLoading: true
  });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const params = new URLSearchParams(window.location.search);
    const sourceType = params.get('sourceType') as any || 'url';
    const url = params.get('url') || '';

    setState(prev => ({ ...prev, sourceType, url, isLoading: true }));

    try {
      let content = '';
      if (sourceType === 'storage') {
        const data = await browser.storage.local.get('temp_odata_content');
        content = data.temp_odata_content;
      } else if (sourceType === 'url' && url) {
        // 尝试获取 URL 内容
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        content = await res.text();
      }

      if (content) {
        const schema = parseODataMetadata(content);
        setState(prev => ({ ...prev, isLoading: false, schema, content }));
      } else {
        setState(prev => ({ ...prev, isLoading: false, error: "未获取到内容，请检查 URL 或上传文件" }));
      }
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, isLoading: false, error: err.message || "解析失败" }));
    }
  };

  const currentEntity = state.schema?.entities.find(e => e.name === selectedEntity);

  return (
    <div className="flex flex-col h-screen text-slate-800">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <Database className="w-5 h-5" />
            </div>
            <div>
                <h1 className="font-bold text-lg leading-tight">OData Visualizer</h1>
                <p className="text-xs text-slate-500 truncate max-w-md" title={state.url}>
                    {state.url || '本地文件模式'}
                </p>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => window.location.reload()} 
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                title="刷新"
            >
                <RefreshCw className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        
        {state.isLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p>正在解析 OData Metadata...</p>
            </div>
        )}

        {state.error && (
             <div className="w-full h-full flex flex-col items-center justify-center text-red-500 p-10">
                <p className="font-bold text-xl mb-2">解析出错了</p>
                <p className="bg-red-50 p-4 rounded border border-red-100">{state.error}</p>
                <button onClick={() => window.history.back()} className="mt-4 text-indigo-600 hover:underline">返回上一页</button>
            </div>
        )}

        {!state.isLoading && !state.error && state.schema && (
            <>
                {/* 左侧：实体列表 */}
                <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Entity Sets</h2>
                    </div>
                    <ul className="flex-1 py-2">
                        {state.schema.entities.map((entity, idx) => (
                            <li key={idx}>
                                <button
                                    onClick={() => setSelectedEntity(entity.name)}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${selectedEntity === entity.name ? 'bg-indigo-50 border-r-4 border-indigo-600' : ''}`}
                                >
                                    <Box className={`w-4 h-4 ${selectedEntity === entity.name ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-sm font-medium ${selectedEntity === entity.name ? 'text-indigo-700' : 'text-slate-700'}`}>
                                        {entity.name}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
                        Namespace: {state.schema.namespace} <br/>
                        Version: {state.schema.version}
                    </div>
                </div>

                {/* 右侧：详情视图 */}
                <div className="flex-1 bg-slate-50 overflow-y-auto p-8">
                    {currentEntity ? (
                        <div className="max-w-4xl mx-auto space-y-6">
                            
                            {/* 实体标题卡片 */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h2 className="text-2xl font-bold text-slate-800">{currentEntity.name}</h2>
                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-mono">Entity</span>
                                    </div>
                                    <p className="text-slate-500 text-sm">此实体包含 {currentEntity.properties.length} 个属性和 {currentEntity.navigationProperties.length} 个导航关联。</p>
                                </div>
                                <div className="text-right">
                                     <span className="text-xs text-slate-400">主键</span>
                                     <div className="flex gap-1 mt-1 justify-end">
                                        {currentEntity.keys.map(k => (
                                            <span key={k} className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded border border-amber-200 font-mono">
                                                {k}
                                            </span>
                                        ))}
                                     </div>
                                </div>
                            </div>

                            {/* 属性列表 */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                    <Code className="w-4 h-4 text-slate-500" />
                                    <h3 className="font-semibold text-slate-700">Properties (属性)</h3>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3">Name</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Nullable</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentEntity.properties.map((prop, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-mono text-slate-700">
                                                    {prop.name}
                                                    {currentEntity.keys.includes(prop.name) && <span className="ml-2 text-amber-500">🔑</span>}
                                                </td>
                                                <td className="px-6 py-3 text-slate-600 font-mono text-xs">{prop.type}</td>
                                                <td className="px-6 py-3">
                                                    {prop.nullable ? 
                                                        <span className="text-slate-400">Yes</span> : 
                                                        <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-xs">Required</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* 导航属性 */}
                            {currentEntity.navigationProperties.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-slate-500" />
                                        <h3 className="font-semibold text-slate-700">Navigation (关联)</h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {currentEntity.navigationProperties.map((nav, idx) => (
                                            <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-indigo-700">{nav.name}</span>
                                                    <ArrowRight className="w-4 h-4 text-slate-300" />
                                                    <button 
                                                        className="text-slate-600 hover:text-indigo-600 underline font-mono text-xs bg-slate-100 px-2 py-1 rounded"
                                                        onClick={() => {
                                                            // 简单的类型名提取逻辑，尝试跳转到关联实体
                                                            const targetName = nav.type.replace(/^Collection\((.*)\)$/, '$1').split('.').pop();
                                                            if (targetName) setSelectedEntity(targetName);
                                                        }}
                                                    >
                                                        {nav.type}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Box className="w-16 h-16 mb-4 text-slate-200" />
                            <p className="text-lg">请从左侧选择一个实体进行查看</p>
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ODataViewerApp />
  </React.StrictMode>
);