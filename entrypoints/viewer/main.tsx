import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Box, Layers, ArrowRight, RefreshCw, Code, Database, AlertCircle, LayoutGrid, List } from 'lucide-react';
import { ViewerState } from '../../types';
import { parseODataMetadata, inferMetadataUrl } from '../../services/odataService';
import ERDiagram from '../../components/ERDiagram'; // 引入组件
import '../../assets/main.css';

const ODataViewerApp: React.FC = () => {
  const [state, setState] = useState<ViewerState>({
    sourceType: 'raw',
    isLoading: true
  });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'details' | 'er'>('details'); // 新增视图模式

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const params = new URLSearchParams(window.location.search);
    const sourceType = params.get('sourceType') as any || 'url';
    let url = params.get('url') || '';
    
    if (url && !url.startsWith('http')) { }

    setState(prev => ({ ...prev, sourceType, url, isLoading: true }));

    try {
      let content = '';
      
      if (sourceType === 'storage') {
        const data = await browser.storage.local.get('temp_odata_content');
        content = data.temp_odata_content;
        parseAndSet(content);
      } else if (sourceType === 'url' && url) {
        let fetchUrl = url;
        
        if (!url.toLowerCase().includes('$metadata')) {
             const metadataUrl = inferMetadataUrl(url);
             try {
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
        setState(prev => ({ ...prev, isLoading: false, schema, content, error: undefined }));
      } catch (e: any) {
          setState(prev => ({ ...prev, isLoading: false, error: `解析失败: ${e.message}。` }));
      }
  };

  const currentEntity = state.schema?.entities.find(e => e.name === selectedEntity);

  return (
    <div className="flex flex-col h-screen text-slate-800 bg-slate-50 font-sans">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10 h-16 shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-sm">
                <Database className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
                <h1 className="font-bold text-lg leading-tight text-slate-800">OData Visualizer</h1>
                <p className="text-xs text-slate-500 truncate max-w-xl font-mono" title={state.url}>
                    {state.url || '本地文件模式'}
                </p>
            </div>
        </div>

        {/* 视图切换 Tabs */}
        {!state.isLoading && !state.error && (
            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                <button 
                    onClick={() => setViewMode('details')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'details' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <List className="w-4 h-4" />
                    Details
                </button>
                <button 
                    onClick={() => setViewMode('er')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'er' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid className="w-4 h-4" />
                    ER Diagram
                </button>
            </div>
        )}

        <div className="flex gap-2">
            <button 
                onClick={() => window.location.reload()} 
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-full transition"
            >
                <RefreshCw className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {state.isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50/90 z-20">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-slate-200 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="mt-4 font-medium">Loading schema...</p>
            </div>
        )}

        {state.error && (
             <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="font-bold text-xl text-slate-800 mb-2">Error</h2>
                    <p className="text-slate-600 mb-6 text-sm whitespace-pre-line">{state.error}</p>
                    <button onClick={() => window.history.back()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Return</button>
                </div>
            </div>
        )}

        {!state.isLoading && !state.error && state.schema && (
            <>
                {viewMode === 'details' ? (
                    /* 详情视图 (原有的左右分栏) */
                    <>
                        <div className="w-72 bg-white border-r border-slate-200 overflow-y-auto flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-0 flex-shrink-0">
                             <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 backdrop-blur-sm z-10">
                                <h2 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Entity Sets</span>
                                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{state.schema.entities.length}</span>
                                </h2>
                            </div>
                            <ul className="flex-1 py-2 space-y-0.5 px-2">
                                {state.schema.entities.map((entity, idx) => (
                                    <li key={idx}>
                                        <button
                                            onClick={() => setSelectedEntity(entity.name)}
                                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-all duration-200 group ${
                                                selectedEntity === entity.name 
                                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                        >
                                            <Box className={`w-4 h-4 flex-shrink-0 ${selectedEntity === entity.name ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                            <span className="text-sm font-medium truncate">
                                                {entity.name}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex-1 bg-slate-50/80 overflow-y-auto p-6 lg:p-10">
                            {currentEntity ? (
                                <div className="max-w-5xl mx-auto space-y-6">
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{currentEntity.name}</h2>
                                            <p className="text-slate-500 text-sm">Namespace: {state.schema.namespace}</p>
                                        </div>
                                         <div className="flex flex-wrap gap-1.5">
                                            {currentEntity.keys.map(k => (
                                                <span key={k} className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md border border-amber-200 font-mono flex items-center gap-1">
                                                    🔑 {k}
                                                </span>
                                            ))}
                                         </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* 属性表格 */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                                            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2 font-bold text-slate-700">
                                                <Code className="w-4 h-4" /> Properties
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                     <thead className="bg-slate-50 text-slate-500 border-b">
                                                        <tr>
                                                            <th className="px-6 py-3">Name</th>
                                                            <th className="px-6 py-3">Type</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {currentEntity.properties.map((p, i) => (
                                                            <tr key={i} className="hover:bg-slate-50">
                                                                <td className="px-6 py-3 font-mono text-slate-700">
                                                                    {p.name} {currentEntity.keys.includes(p.name) && '🔑'}
                                                                </td>
                                                                <td className="px-6 py-3 text-slate-500 text-xs">{p.type}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        {/* 导航属性 */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden h-fit">
                                            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2 font-bold text-slate-700">
                                                <Layers className="w-4 h-4" /> Navigation
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {currentEntity.navigationProperties.map((nav, i) => (
                                                    <div key={i} className="px-6 py-3 flex justify-between items-center hover:bg-slate-50">
                                                        <span className="font-mono text-indigo-700 font-medium text-sm">{nav.name}</span>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <ArrowRight className="w-3 h-3" />
                                                            <span className="bg-slate-100 px-2 py-1 rounded border">{nav.type}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {currentEntity.navigationProperties.length === 0 && <div className="p-4 text-center text-slate-400 text-sm">None</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Box className="w-12 h-12 text-indigo-200 mb-4" />
                                    <p>Select an entity to view details</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* ER 图视图 */
                    <ERDiagram schema={state.schema} />
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