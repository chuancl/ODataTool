import React, { useState, useEffect, useMemo } from 'react';
import { Play, Copy, Check, Filter, ArrowUpDown, Plus, X, ChevronRight, ChevronDown, Table as TableIcon, Code, FileJson, FileCode, ArrowLeft, CornerDownRight, Rss } from 'lucide-react';
import { ODataSchema, ODataEntity } from '../types';

interface QueryBuilderProps {
  schema: ODataSchema;
  metadataUrl: string;
}

// 辅助：标准化 OData 响应数据 (兼容 V2 d.results 和 V4 value)
const normalizeODataResponse = (data: any): any => {
    if (!data) return [];
    // V4 Collection
    if (Array.isArray(data.value)) return data.value;
    // V2 Response Wrapper
    if (data.d) {
        // V2 Collection
        if (Array.isArray(data.d.results)) return data.d.results;
        // V2 Single/Collection without results
        if (Array.isArray(data.d)) return data.d;
        return data.d;
    }
    return data;
};

// 辅助：简单的表格渲染组件
const DataTable: React.FC<{ data: any; onDrillDown: (key: string, val: any) => void }> = ({ data, onDrillDown }) => {
    if (Array.isArray(data)) {
        if (data.length === 0) return <div className="p-4 text-slate-400 text-xs italic">空数组 (No Items)</div>;
        
        // 提取所有可能的列名 (取前5条数据的所有key，防止第一条数据缺字段)
        const columns = Array.from(new Set(data.slice(0, 5).flatMap(Object.keys)));

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-2 border border-slate-200 w-10 text-center font-mono">#</th>
                            {columns.map(col => (
                                <th key={col} className="p-2 border border-slate-200 font-semibold whitespace-nowrap">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-2 border border-slate-200 text-center text-slate-400 font-mono select-none">{idx + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="p-2 border border-slate-200 font-mono text-slate-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                                        <DataCell value={row[col]} colName={col} onDrill={() => onDrillDown(`${idx}.${col}`, row[col])} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    } else if (typeof data === 'object' && data !== null) {
        // 单个对象视图
        return (
            <div className="overflow-x-auto p-4">
                 <table className="w-full max-w-2xl text-left border-collapse text-xs">
                    <tbody>
                        {Object.entries(data).map(([key, val]) => (
                            <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2 px-3 font-semibold text-slate-600 w-1/3 bg-slate-50/50">{key}</td>
                                <td className="py-2 px-3 font-mono text-slate-700">
                                     <DataCell value={val} colName={key} onDrill={() => onDrillDown(key, val)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        );
    }
    return <div className="p-4 font-mono text-sm">{String(data)}</div>;
};

// 辅助：单元格渲染
const DataCell: React.FC<{ value: any; colName: string; onDrill: () => void }> = ({ value, colName, onDrill }) => {
    if (value === null || value === undefined) return <span className="text-slate-300 italic">null</span>;
    
    if (Array.isArray(value)) {
        return (
            <button onClick={onDrill} className="flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition">
                <TableIcon className="w-3 h-3" />
                <span>{value.length} items</span>
                <ChevronRight className="w-3 h-3 opacity-50" />
            </button>
        );
    }
    
    if (typeof value === 'object') {
        return (
             <button onClick={onDrill} className="flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition">
                <CornerDownRight className="w-3 h-3" />
                <span>Object</span>
            </button>
        );
    }
    
    // 简单的值
    const str = String(value);
    // 看起来像 URL 的简单的超链接处理
    if (str.startsWith('http')) {
        return <a href={str} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1" onClick={e=>e.stopPropagation()}>{str}</a>
    }

    return <span>{str}</span>;
}


const QueryBuilder: React.FC<QueryBuilderProps> = ({ schema, metadataUrl }) => {
  // 基础 URL (去掉 /$metadata)
  const serviceRoot = useMemo(() => {
    return metadataUrl.replace(/\/\$metadata$/, '').replace(/\/$/, '');
  }, [metadataUrl]);

  // Query State
  const [selectedSet, setSelectedSet] = useState<string>('');
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  const [expandProps, setExpandProps] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderByDir, setOrderByDir] = useState<'asc' | 'desc'>('asc');
  const [top, setTop] = useState<number | ''>('');
  const [skip, setSkip] = useState<number | ''>('');
  const [count, setCount] = useState(false);
  
  // Format & View State
  const [reqFormat, setReqFormat] = useState<'json' | 'xml' | 'atom'>('json'); // 请求格式
  const [viewMode, setViewMode] = useState<'code' | 'table'>('code'); // 视图模式
  
  // Result State
  const [resultData, setResultData] = useState<any>(null); // JSON 对象
  const [resultText, setResultText] = useState<string>(''); // XML 文本 或 原始文本
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill Down Stack for Table View
  const [drillStack, setDrillStack] = useState<Array<{ title: string, data: any }>>([]);

  // 初始化：默认选中第一个 EntitySet
  useEffect(() => {
    if (schema.entitySets.length > 0 && !selectedSet) {
      setSelectedSet(schema.entitySets[0].name);
    }
  }, [schema]);

  // 当前选中的 EntitySet 对应的 EntityType
  const currentEntity = useMemo(() => {
    const setDef = schema.entitySets.find(s => s.name === selectedSet);
    if (!setDef) return null;
    const typeName = setDef.entityType.split('.').pop(); 
    return schema.entities.find(e => e.name === typeName || e.name === setDef.entityType);
  }, [selectedSet, schema]);

  // 重置
  useEffect(() => {
    setSelectedProps(new Set());
    setExpandProps(new Set());
    setFilter('');
    setOrderBy('');
    setTop('');
    setSkip('');
    setResultData(null);
    setResultText('');
    setError(null);
    setDrillStack([]);
  }, [selectedSet]);

  // 构建标准编码的 URL (用于 Fetch 请求)
  const generatedUrl = useMemo(() => {
    if (!selectedSet) return '';
    const params = new URLSearchParams();

    if (selectedProps.size > 0 && currentEntity && selectedProps.size < currentEntity.properties.length) {
      params.append('$select', Array.from(selectedProps).join(','));
    }

    if (expandProps.size > 0) {
      params.append('$expand', Array.from(expandProps).join(','));
    }

    if (filter) params.append('$filter', filter);
    
    if (orderBy) {
      params.append('$orderby', `${orderBy} ${orderByDir}`);
    }

    if (top !== '') params.append('$top', String(top));
    if (skip !== '') params.append('$skip', String(skip));
    
    // OData 版本兼容逻辑
    if (count) {
        const isV4 = schema.version && schema.version.startsWith('4');
        if (isV4) params.append('$count', 'true');
        else params.append('$inlinecount', 'allpages');
    }

    const queryString = params.toString();
    return `${serviceRoot}/${selectedSet}${queryString ? '?' + queryString : ''}`;
  }, [serviceRoot, selectedSet, selectedProps, expandProps, filter, orderBy, orderByDir, top, skip, count, currentEntity, schema.version]);

  // 构建展示用的 URL
  const displayUrl = useMemo(() => {
    if (!generatedUrl) return '';
    try {
      return decodeURIComponent(generatedUrl.replace(/\+/g, '%20'));
    } catch (e) {
      return generatedUrl;
    }
  }, [generatedUrl]);

  const toggleSelection = (set: Set<string>, val: string, updater: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const newSet = new Set(set);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    updater(newSet);
  };

  const executeQuery = async () => {
    if (!generatedUrl) return;
    setLoading(true);
    setError(null);
    setResultData(null);
    setResultText('');
    setDrillStack([]); // 清空下钻堆栈

    try {
      // 动态设置 Header
      const headers: any = {};
      if (reqFormat === 'xml') {
          headers['Accept'] = 'application/xml, text/xml';
      } else if (reqFormat === 'atom') {
          headers['Accept'] = 'application/atom+xml';
      } else {
          headers['Accept'] = 'application/json, application/json;odata.metadata=minimal';
      }

      const res = await fetch(generatedUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      
      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';

      if (reqFormat === 'json') {
          // 尝试解析 JSON
          try {
              const json = JSON.parse(text);
              setResultData(json);
              
              if (viewMode === 'table') {
                  // do nothing
              }
          } catch (e) {
              // 解析失败，可能是服务器忽略了 Accept 返回了 XML
              setResultText(text);
              // 强制切回 XML 显示，避免空白
              if (text.trim().startsWith('<')) {
                  // 粗略判断是 XML 还是 Atom，这里统一只做非 JSON 处理
                  if (!reqFormat.includes('xml') && !reqFormat.includes('atom')) {
                       setReqFormat('xml');
                  }
                  throw new Error("服务器返回了 XML 数据，已自动切换到文本视图。");
              } else {
                  throw new Error("无法解析 JSON 响应: " + text.substring(0, 50));
              }
          }
      } else {
          // XML 或 Atom 模式
          setResultText(text);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = (key: string, data: any) => {
      setDrillStack(prev => [...prev, { title: key, data }]);
  };

  const handleDrillUp = (index: number) => {
      // index is the target index to go back to. 
      // -1 means root.
      if (index === -1) {
          setDrillStack([]);
      } else {
          setDrillStack(prev => prev.slice(0, index + 1));
      }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(displayUrl);
  };

  if (!schema.entitySets.length) {
    return <div className="p-8 text-center text-slate-500">此 OData 服务未定义 EntitySets，无法构建查询。</div>;
  }

  // 计算当前用于 Table 显示的数据
  const currentTableData = useMemo(() => {
      if (drillStack.length > 0) {
          return normalizeODataResponse(drillStack[drillStack.length - 1].data);
      }
      return normalizeODataResponse(resultData);
  }, [resultData, drillStack]);

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* 左侧配置面板 */}
      <div className="w-[360px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">EntitySet</label>
          <div className="relative">
            <select 
              value={selectedSet} 
              onChange={e => setSelectedSet(e.target.value)}
              className="w-full p-2 pl-3 pr-8 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              {schema.entitySets.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {currentEntity && (
             <div className="mt-1 text-[10px] text-slate-400 font-mono">Type: {currentEntity.name}</div>
          )}
        </div>

        {currentEntity ? (
          <div className="flex-1 p-4 space-y-6">
            {/* $select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-indigo-500" /> 字段 ($select)
                </h3>
                <button 
                  onClick={() => setSelectedProps(new Set(selectedProps.size === 0 ? currentEntity.properties.map(p=>p.name) : []))}
                  className="text-[10px] text-indigo-600 hover:underline"
                >
                  {selectedProps.size === 0 ? '全选' : '清空'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50 grid grid-cols-1 gap-0.5">
                {currentEntity.properties.map(p => (
                  <label key={p.name} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-1.5 py-1 rounded transition-colors group">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={selectedProps.has(p.name)}
                      onChange={() => toggleSelection(selectedProps, p.name, setSelectedProps)}
                    />
                    <span className={`text-xs truncate transition-colors ${selectedProps.has(p.name) ? 'text-slate-800 font-medium' : 'text-slate-500 group-hover:text-slate-700'}`} title={p.name}>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* $expand */}
            {currentEntity.navigationProperties.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                   <Plus className="w-3.5 h-3.5 text-indigo-500" /> 关联展开 ($expand)
                </h3>
                <div className="border border-slate-200 rounded-md p-2 bg-slate-50 flex flex-wrap gap-2">
                  {currentEntity.navigationProperties.map(np => (
                     <label key={np.name} className={`px-2 py-1 rounded text-xs border cursor-pointer transition-colors ${expandProps.has(np.name) ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-medium' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={expandProps.has(np.name)}
                          onChange={() => toggleSelection(expandProps, np.name, setExpandProps)}
                        />
                        {np.name}
                     </label>
                  ))}
                </div>
              </div>
            )}

            {/* Filtering & Sorting */}
            <div className="space-y-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" /> 过滤 ($filter)
                  </h3>
                  <input 
                    type="text" 
                    placeholder="e.g. Price gt 20" 
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                  />
               </div>

               <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" /> 排序 ($orderby)
                  </h3>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none bg-white"
                      value={orderBy}
                      onChange={e => setOrderBy(e.target.value)}
                    >
                      <option value="">(无排序)</option>
                      {currentEntity.properties.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select 
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none bg-white"
                      value={orderByDir}
                      onChange={e => setOrderByDir(e.target.value as 'asc' | 'desc')}
                    >
                      <option value="asc">ASC</option>
                      <option value="desc">DESC</option>
                    </select>
                  </div>
               </div>
            </div>

            {/* Pagination */}
            <div className="grid grid-cols-2 gap-3 pb-4">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">$top</label>
                  <input 
                    type="number" 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="All"
                    value={top}
                    onChange={e => setTop(e.target.value ? Number(e.target.value) : '')}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">$skip</label>
                  <input 
                    type="number" 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    placeholder="0"
                    value={skip}
                    onChange={e => setSkip(e.target.value ? Number(e.target.value) : '')}
                  />
               </div>
               <div className="col-span-2 pt-1">
                 <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input type="checkbox" checked={count} onChange={e => setCount(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                    <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">是否返回内联计数 ($inlinecount/$count)</span>
                 </label>
               </div>
            </div>

          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">请先选择一个 EntitySet</div>
        )}
      </div>

      {/* 右侧结果面板 */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden min-w-0">
        {/* Header Area */}
        <div className="bg-white border-b border-slate-200 shadow-sm z-10 p-4 shrink-0">
           {/* Top Row: URL & Copy */}
           <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                 生成链接
                 <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">GET</span>
              </h2>
              <button onClick={copyToClipboard} className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition px-2 py-1 rounded hover:bg-slate-50">
                 <Copy className="w-3.5 h-3.5" /> 复制
              </button>
           </div>
           
           {/* URL Box */}
           <div className="bg-slate-800 rounded-md p-3 relative group mb-4">
              <code className="text-xs font-mono text-green-400 break-all whitespace-pre-wrap block max-h-24 overflow-y-auto custom-scrollbar">
                {displayUrl}
              </code>
           </div>

           {/* Controls Row: Format Select & Run */}
           <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">返回格式</label>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => { setReqFormat('json'); setViewMode('code'); }} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${reqFormat === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileJson className="w-3.5 h-3.5" /> JSON
                        </button>
                        <button 
                            onClick={() => { setReqFormat('xml'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${reqFormat === 'xml' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileCode className="w-3.5 h-3.5" /> XML
                        </button>
                        <button 
                            onClick={() => { setReqFormat('atom'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${reqFormat === 'atom' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Rss className="w-3.5 h-3.5" /> Atom
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Switcher (Only visible for JSON) */}
                    {reqFormat === 'json' && (
                        <div className="flex flex-col gap-1 items-end">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">视图模式</label>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button 
                                    onClick={() => setViewMode('code')} 
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'code' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Code className="w-3.5 h-3.5" /> 代码
                                </button>
                                <button 
                                    onClick={() => setViewMode('table')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <TableIcon className="w-3.5 h-3.5" /> 表格
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    <button 
                        onClick={executeQuery} 
                        disabled={loading || !generatedUrl}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-md text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow active:translate-y-px"
                    >
                        {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                        <Play className="w-4 h-4 fill-current" />
                        )}
                        Run Query
                    </button>
                </div>
           </div>
        </div>

        {/* 结果区域 */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/50 flex flex-col">
           {error && (
             <div className="m-4 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="mt-0.5 flex-shrink-0"><X className="w-4 h-4" /></div>
                <div className="whitespace-pre-wrap font-mono break-all">{error}</div>
             </div>
           )}

           {!error && !resultData && !resultText && !loading && (
             <div className="h-full flex flex-col items-center justify-center text-slate-300 select-none">
                <Play className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-sm font-medium">点击 "Run Query" 获取数据</p>
             </div>
           )}

           {(resultData || resultText) && (
               <div className="flex-1 overflow-auto h-full w-full">
                    {reqFormat === 'json' ? (
                        viewMode === 'code' ? (
                            <div className="h-full w-full overflow-auto">
                                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 flex justify-between sticky top-0">
                                    <span>JSON Response</span>
                                    {resultData['@odata.count'] && <span className="text-indigo-600">Count: {resultData['@odata.count']}</span>}
                                </div>
                                <pre className="p-4 text-xs font-mono text-slate-700 w-full">
                                    {JSON.stringify(resultData, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            // Table View with Drill Down
                            <div className="flex flex-col h-full w-full bg-white">
                                {drillStack.length > 0 && (
                                    <div className="flex items-center gap-2 p-2 bg-indigo-50 border-b border-indigo-100 text-xs overflow-x-auto whitespace-nowrap sticky top-0 z-20">
                                        <button onClick={() => handleDrillUp(-1)} className="hover:bg-indigo-100 p-1 rounded text-indigo-700 font-bold flex items-center gap-1">
                                            <ArrowLeft className="w-3 h-3" /> Root
                                        </button>
                                        {drillStack.map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <ChevronRight className="w-3 h-3 text-indigo-300" />
                                                <button 
                                                    onClick={() => handleDrillUp(idx)}
                                                    className={`p-1 rounded hover:bg-indigo-100 transition ${idx === drillStack.length - 1 ? 'font-bold text-indigo-800' : 'text-indigo-600'}`}
                                                >
                                                    {item.title}
                                                </button>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                                <div className="flex-1 overflow-auto">
                                    <DataTable 
                                        data={currentTableData} 
                                        onDrillDown={handleDrillDown} 
                                    />
                                </div>
                            </div>
                        )
                    ) : (
                        // XML or Atom View
                        <div className="h-full w-full overflow-auto">
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 sticky top-0">
                                <span>{reqFormat === 'atom' ? 'Atom' : 'XML'} Response</span>
                            </div>
                            <pre className="p-4 text-xs font-mono text-slate-700 w-full whitespace-pre-wrap break-all">
                                {resultText}
                            </pre>
                        </div>
                    )}
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default QueryBuilder;