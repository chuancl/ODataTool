import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Box, Layers, ArrowRight, RefreshCw, Code, Database, AlertCircle, LayoutGrid, List } from 'lucide-react';
import { ViewerState } from '../../types';
import { parseODataMetadata, inferMetadataUrl } from '../../services/odataService';
import ERDiagram from '../../components/ERDiagram';
import '../../assets/main.css';

// *** 关键修复：直接从 npm 包引入样式，确保在 Extension 环境中生效 ***
import '@xyflow/react/dist/style.css'; 

const ODataViewerApp: React.FC = () => {
  const [state, setState] = useState<ViewerState>({
    sourceType: 'raw',
    isLoading: true
  });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'details' | 'er'>('details'); // 默认视图

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const params = new URLSearchParams(window.location.search);
    const sourceType = params.get('sourceType') as any || 'url';
    let url = params.get('url') || '';
    
    // 稍微延迟 loading 状态，避免闪烁
    setState(prev => ({ ...prev, sourceType, url, isLoading: true }));

    try {
      let content = '';
      
      if (sourceType === 'storage') {
        const data = await browser.storage.local.get('temp_odata_content');
        content = data.temp_odata_content;
        parseAndSet(content);
      } else if (sourceType === 'url' && url) {
        let fetchUrl = url;
        
        // 尝试智能推断 $metadata
        if (!url.toLowerCase().includes('$metadata')) {
             const metadataUrl = inferMetadataUrl(url);
             try {
                 // 快速预检
                 const res = await fetch(metadataUrl);
                 if (res.ok) {
                     const text = await res.text();
                     if (text.includes('Edmx') || text.includes('Schema')) {
                         fetchUrl = metadataUrl;
                         content = text;
                         setState(prev => ({ ...prev, url: metadataUrl }));
                     }
                 }
             } catch (e) {
                 console.warn("Failed to fetch inferred metadata");
             }
        }

        if (!content) {
            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            content = await res.text();
        }

        parseAndSet(content);
      } else {
        setState(prev => ({ ...prev, isLoading: false, error: "无效的来源或 URL" }));
      }
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, isLoading: false, error: `请求失败: ${err.message}\n请检查该 OData 服务是否允许跨域 (CORS)。` }));
    }
  };

  const parseAndSet = (content: string) => {
      try {
        const schema = parseODataMetadata(content);
        // 如果解析成功，默认切换到 ER 图视图，展示成果
        setViewMode('er'); 
        setState(prev => ({ ...prev, isLoading: false, schema, content, error: undefined }));
      } catch (e: any) {
          setState(prev => ({ ...prev, isLoading: false, error: `解析失败: ${e.message}。` }));
      }
  };

  const currentEntity = state.schema?.entities.find(e => e.name === selectedEntity);

  return (
    <div className="flex flex-col h-screen text-slate-800 bg-slate-50 font-sans">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm z-10 h-14 shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-1.5 rounded-md text-white shadow-sm">
                <Database className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
                <h1 className="font-bold text-base leading-tight text-slate-800">OData Visualizer</h1>
                <p className="text-[10px] text-slate-500 truncate max-w-xl font-mono opacity-80" title={state.url}>
                    {state.url || 'Local File'}
                </p>
            </div>
        </div>

        {/* 视图切换 Tabs */}
        {!state.isLoading && !state.error && (
            <div className="bg-slate-100 p-0.5 rounded-md flex items-center border border-slate-200">
                <button 
                    onClick={() => setViewMode('details')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition ${viewMode === 'details' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <List className="w-3.5 h-3.5" />
                    List
                </button>
                <button 
                    onClick={() => setViewMode('er')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition ${viewMode === 'er' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Diagram
                </button>
            </div>
        )}

        <div className="flex gap-2">
            <button 
                onClick={() => window.location.reload()} 
                className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-full transition"
                title="Reload"
            >
                <RefreshCw className="w-4 h-4" />
            </button>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full h-full">
        
        {state.isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50 z-20">
                <div className="w-8 h-8 border-4 border-indigo-200 rounded-full border-t-indigo-600 animate-spin"></div>
                <p className="mt-4 font-medium text-sm">Parsing metadata...</p>
            </div>
        )}

        {state.error && (
             <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-lg w-full text-center">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-lg text-slate-800 mb-2">Error Occurred</h2>
                    <p className="text-slate-600 mb-6 text-sm whitespace-pre-line">{state.error}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium">Try Again</button>
                </div>
            </div>
        )}

        {!state.isLoading && !state.error && state.schema && (
            <>
                {viewMode === 'details' ? (
                    <div className="flex w-full h-full overflow-hidden">
                        {/* 左侧列表 */}
                        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto flex flex-col z-0 flex-shrink-0">
                             <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                                <h2 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Entities</span>
                                    <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full">{state.schema.entities.length}</span>
                                </h2>
                            </div>
                            <ul className="flex-1 py-1">
                                {state.schema.entities.map((entity, idx) => (
                                    <li key={idx}>
                                        <button
                                            onClick={() => setSelectedEntity(entity.name)}
                                            className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors border-l-2 ${
                                                selectedEntity === entity.name 
                                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700' 
                                                : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                        >
                                            <span className="text-xs font-medium truncate">{entity.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 详情内容 */}
                        <div className="flex-1 bg-white overflow-y-auto p-8">
                            {currentEntity ? (
                                <div className="max-w-4xl mx-auto space-y-8">
                                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800">{currentEntity.name}</h2>
                                            <p className="text-slate-400 text-xs mt-1 font-mono">{state.schema.namespace}.{currentEntity.name}</p>
                                        </div>
                                         <div className="flex flex-wrap gap-2">
                                            {currentEntity.keys.map(k => (
                                                <span key={k} className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded border border-amber-100 font-mono flex items-center gap-1">
                                                    Key: {k}
                                                </span>
                                            ))}
                                         </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Code className="w-4 h-4 text-slate-400" /> Properties
                                            </h3>
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="px-3 py-2 border border-slate-200 font-semibold">Name</th>
                                                        <th className="px-3 py-2 border border-slate-200 font-semibold">Type</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentEntity.properties.map((p, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="px-3 py-2 border border-slate-100 font-mono text-slate-700">
                                                                {p.name} {currentEntity.keys.includes(p.name) && '🔑'}
                                                            </td>
                                                            <td className="px-3 py-2 border border-slate-100 text-slate-500">{p.type}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-slate-400" /> Navigation
                                            </h3>
                                            <div className="border border-slate-200 rounded-md overflow-hidden">
                                                {currentEntity.navigationProperties.map((nav, i) => (
                                                    <div key={i} className="px-3 py-2 flex justify-between items-center hover:bg-slate-50 border-b border-slate-100 last:border-0 text-xs">
                                                        <span className="font-medium text-indigo-700">{nav.name}</span>
                                                        <div className="flex items-center gap-1 text-slate-400">
                                                            <ArrowRight className="w-3 h-3" />
                                                            <span className="font-mono">{nav.type}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {currentEntity.navigationProperties.length === 0 && <div className="p-3 text-center text-slate-400 text-xs italic">No relationships</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <p>Select an entity from the list</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // ER Diagram 视图
                    <div className="w-full h-full bg-slate-50 relative overflow-hidden">
                        <ERDiagram schema={state.schema} />
                    </div>
                )}
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