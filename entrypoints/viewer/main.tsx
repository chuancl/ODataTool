import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Box, Layers, ArrowRight, RefreshCw, Code, Database, AlertCircle } from 'lucide-react';
import { ViewerState } from '../../types';
import { parseODataMetadata, inferMetadataUrl } from '../../services/odataService';
import '../../assets/main.css'; // 引入 Tailwind CSS

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
    let url = params.get('url') || '';
    
    // 如果 URL 被 decode 导致问题，确保它是完整的
    if (url && !url.startsWith('http')) {
        // 有时候参数传递会被截断，这里做个简单防护，但这通常不会发生
    }

    setState(prev => ({ ...prev, sourceType, url, isLoading: true }));

    try {
      let content = '';
      
      if (sourceType === 'storage') {
        const data = await browser.storage.local.get('temp_odata_content');
        content = data.temp_odata_content;
        parseAndSet(content);
      } else if (sourceType === 'url' && url) {
        let fetchUrl = url;
        
        // 智能逻辑：如果当前 URL 不是 metadata，我们尝试推断并获取 metadata
        if (!url.toLowerCase().includes('$metadata')) {
             const metadataUrl = inferMetadataUrl(url);
             console.log(`[Viewer] Inferring Metadata URL: ${metadataUrl}`);
             
             try {
                 const res = await fetch(metadataUrl);
                 if (res.ok) {
                     const text = await res.text();
                     if (text.includes('Edmx') || text.includes('Schema')) {
                         fetchUrl = metadataUrl;
                         content = text;
                         setState(prev => ({ ...prev, url: metadataUrl })); // 更新 UI 显示实际解析的 URL
                     }
                 }
             } catch (e) {
                 console.warn("Failed to fetch inferred metadata, falling back to original.");
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
      setState(prev => ({ ...prev, isLoading: false, error: `请求失败: ${err.message}\n请检查该 OData 服务是否允许跨域 (CORS)，或尝试手动上传 Metadata 文件。` }));
    }
  };

  const parseAndSet = (content: string) => {
      try {
        const schema = parseODataMetadata(content);
        setState(prev => ({ ...prev, isLoading: false, schema, content, error: undefined }));
      } catch (e: any) {
          setState(prev => ({ ...prev, isLoading: false, error: `解析失败: ${e.message}。请确保这是有效的 OData Metadata XML。` }));
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
        <div className="flex gap-2">
            <button 
                onClick={() => window.location.reload()} 
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-full transition"
                title="重新加载"
            >
                <RefreshCw className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        
        {state.isLoading && (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-slate-200 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="mt-4 font-medium">正在分析 OData 服务...</p>
            </div>
        )}

        {state.error && (
             <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="font-bold text-xl text-slate-800 mb-2">无法展示</h2>
                    <p className="text-slate-600 mb-6 text-sm whitespace-pre-line">{state.error}</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => window.history.back()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition">
                            返回
                        </button>
                    </div>
                </div>
            </div>
        )}

        {!state.isLoading && !state.error && state.schema && (
            <>
                {/* 左侧：实体列表 */}
                <div className="w-72 bg-white border-r border-slate-200 overflow-y-auto flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-0">
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
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-[10px] text-slate-400 font-mono break-all">
                        <div className="mb-1"><span className="font-bold text-slate-500">NS:</span> {state.schema.namespace}</div>
                        <div><span className="font-bold text-slate-500">Ver:</span> {state.schema.version}</div>
                    </div>
                </div>

                {/* 右侧：详情视图 */}
                <div className="flex-1 bg-slate-50/80 overflow-y-auto p-6 lg:p-10">
                    {currentEntity ? (
                        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            
                            {/* 实体标题卡片 */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 lg:p-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{currentEntity.name}</h2>
                                        <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">Entity Type</span>
                                    </div>
                                    <p className="text-slate-500 text-sm">
                                        Defined in namespace <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">{state.schema.namespace}</span>
                                    </p>
                                </div>
                                <div className="text-left md:text-right bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                                     <span className="text-xs font-bold text-amber-600 uppercase tracking-wide block mb-1.5">Primary Key</span>
                                     <div className="flex flex-wrap gap-1.5 md:justify-end">
                                        {currentEntity.keys.map(k => (
                                            <span key={k} className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md border border-amber-200 font-mono font-medium flex items-center gap-1 shadow-sm">
                                                <span className="text-[10px]">🔑</span> {k}
                                            </span>
                                        ))}
                                     </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 属性列表 */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
                                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Code className="w-4 h-4 text-slate-500" />
                                            <h3 className="font-bold text-slate-700">Properties</h3>
                                        </div>
                                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{currentEntity.properties.length}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3 whitespace-nowrap">Property Name</th>
                                                    <th className="px-6 py-3 whitespace-nowrap">Type</th>
                                                    <th className="px-6 py-3 whitespace-nowrap text-center">Req.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {currentEntity.properties.map((prop, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-6 py-3 font-mono text-slate-700 font-medium">
                                                            {prop.name}
                                                            {currentEntity.keys.includes(prop.name) && <span className="ml-2 text-amber-500" title="Key">🔑</span>}
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">{prop.type}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {!prop.nullable && (
                                                                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" title="Required"></span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 导航属性 */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
                                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-slate-500" />
                                            <h3 className="font-bold text-slate-700">Navigation</h3>
                                        </div>
                                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{currentEntity.navigationProperties.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {currentEntity.navigationProperties.length > 0 ? (
                                            currentEntity.navigationProperties.map((nav, idx) => (
                                                <div key={idx} className="px-6 py-4 flex flex-col gap-1 hover:bg-slate-50/80 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono text-indigo-700 font-medium text-sm">{nav.name}</span>
                                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <span className="text-xs text-slate-400">Target Type:</span>
                                                        <button 
                                                            className="text-slate-600 hover:text-indigo-600 hover:underline font-mono text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-colors"
                                                            onClick={() => {
                                                                const targetName = nav.type.replace(/^Collection\((.*)\)$/, '$1').split('.').pop();
                                                                if (targetName) setSelectedEntity(targetName);
                                                            }}
                                                        >
                                                            {nav.type}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                No navigation properties defined.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                <Box className="w-10 h-10 text-indigo-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Welcome to OData Visualizer</h3>
                            <p className="text-slate-500 max-w-md text-center">
                                从左侧列表选择一个 Entity Set 来查看其属性和关联关系图。
                            </p>
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