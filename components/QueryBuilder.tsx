import React, { useState, useEffect, useMemo } from 'react';
import { Play, Copy, Check, Filter, ArrowUpDown, Plus, X, ChevronRight, ChevronDown } from 'lucide-react';
import { ODataSchema, ODataEntity } from '../types';

interface QueryBuilderProps {
  schema: ODataSchema;
  metadataUrl: string;
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({ schema, metadataUrl }) => {
  // 基础 URL (去掉 /$metadata)
  const serviceRoot = useMemo(() => {
    return metadataUrl.replace(/\/\$metadata$/, '').replace(/\/$/, '');
  }, [metadataUrl]);

  // 状态管理
  const [selectedSet, setSelectedSet] = useState<string>('');
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set());
  const [expandProps, setExpandProps] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [orderByDir, setOrderByDir] = useState<'asc' | 'desc'>('asc');
  const [top, setTop] = useState<number | ''>('');
  const [skip, setSkip] = useState<number | ''>('');
  const [count, setCount] = useState(false);
  
  // 执行结果
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    
    // 处理命名空间：有些 EntityType 带命名空间，有些不带
    const typeName = setDef.entityType.split('.').pop(); 
    return schema.entities.find(e => e.name === typeName || e.name === setDef.entityType);
  }, [selectedSet, schema]);

  // 当切换实体时，重置字段选择
  useEffect(() => {
    setSelectedProps(new Set());
    setExpandProps(new Set());
    setFilter('');
    setOrderBy('');
    setTop('');
    setSkip('');
    setResult(null);
    setError(null);
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
    if (count) params.append('$count', 'true');

    const queryString = params.toString();
    return `${serviceRoot}/${selectedSet}${queryString ? '?' + queryString : ''}`;
  }, [serviceRoot, selectedSet, selectedProps, expandProps, filter, orderBy, orderByDir, top, skip, count, currentEntity]);

  // 构建展示用的 URL (解码/未转义，方便用户阅读和复制)
  const displayUrl = useMemo(() => {
    if (!generatedUrl) return '';
    try {
      // URLSearchParams 会将空格编码为 '+'，我们需要先将其替换为 '%20'，
      // 这样 decodeURIComponent 才能正确地将其还原为空格，而不是保留为 '+'。
      // 同时 decodeURIComponent 会处理 %27 -> ' 等其他字符。
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
    // 请求时使用 generatedUrl (编码版) 以保证安全和兼容
    if (!generatedUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 显式请求 JSON 格式，解决 OData V2/V3 默认返回 XML 的问题
      const res = await fetch(generatedUrl, {
          headers: {
              'Accept': 'application/json, application/json;odata.metadata=minimal, text/plain'
          }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      
      const contentType = res.headers.get('content-type') || '';
      
      // 尝试解析 JSON
      if (contentType.includes('json')) {
        const data = await res.json();
        setResult(data);
      } else {
        // 如果服务器返回了非 JSON 格式（比如 XML 或 Text）
        const text = await res.text();
        try {
            // 再次尝试强行 Parse，防止 Header 缺失 application/json 但内容确实是 json
            const data = JSON.parse(text);
            setResult(data);
        } catch (e) {
             // 如果解析失败，说明确实是 XML 或其他格式
             // 检查是否是 XML 格式的 OData Feed
             if (text.trim().startsWith('<')) {
                 throw new Error(`服务器返回了 XML 格式数据，请检查该服务是否支持 JSON。\n(提示: 某些旧版 OData 服务可能需要添加 $format=json 参数，或不支持 JSON 响应)`);
             }
             throw new Error(`Received non-JSON response (${contentType}).\n${text.substring(0, 100)}...`);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    // 复制时使用 displayUrl (解码版)
    navigator.clipboard.writeText(displayUrl);
  };

  if (!schema.entitySets.length) {
    return <div className="p-8 text-center text-slate-500">此 OData 服务未定义 EntitySets，无法构建查询。</div>;
  }

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* 左侧配置面板 */}
      <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">目标数据集 (EntitySet)</label>
          <div className="relative">
            <select 
              value={selectedSet} 
              onChange={e => setSelectedSet(e.target.value)}
              className="w-full p-2 pl-3 pr-8 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none"
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
                  <Check className="w-3 h-3 text-indigo-500" /> 字段 ($select)
                </h3>
                <button 
                  onClick={() => setSelectedProps(new Set(selectedProps.size === 0 ? currentEntity.properties.map(p=>p.name) : []))}
                  className="text-[10px] text-indigo-600 hover:underline"
                >
                  {selectedProps.size === 0 ? '全选' : '清空'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50 grid grid-cols-2 gap-2">
                {currentEntity.properties.map(p => (
                  <label key={p.name} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      checked={selectedProps.has(p.name)}
                      onChange={() => toggleSelection(selectedProps, p.name, setSelectedProps)}
                    />
                    <span className="text-xs text-slate-600 truncate" title={p.name}>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* $expand */}
            {currentEntity.navigationProperties.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                   <Plus className="w-3 h-3 text-indigo-500" /> 关联展开 ($expand)
                </h3>
                <div className="border border-slate-200 rounded-md p-2 bg-slate-50 flex flex-wrap gap-2">
                  {currentEntity.navigationProperties.map(np => (
                     <label key={np.name} className={`px-2 py-1 rounded text-xs border cursor-pointer transition-colors ${expandProps.has(np.name) ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
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
            <div className="grid grid-cols-1 gap-4">
               <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-indigo-500" /> 过滤 ($filter)
                  </h3>
                  <input 
                    type="text" 
                    placeholder="e.g. Price gt 20 and Name eq 'Test'" 
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                  />
               </div>

               <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-indigo-500" /> 排序 ($orderby)
                  </h3>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                      value={orderBy}
                      onChange={e => setOrderBy(e.target.value)}
                    >
                      <option value="">(无排序)</option>
                      {currentEntity.properties.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select 
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
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
            <div className="grid grid-cols-3 gap-3">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">$top</label>
                  <input 
                    type="number" 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    placeholder="All"
                    value={top}
                    onChange={e => setTop(e.target.value ? Number(e.target.value) : '')}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">$skip</label>
                  <input 
                    type="number" 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    placeholder="0"
                    value={skip}
                    onChange={e => setSkip(e.target.value ? Number(e.target.value) : '')}
                  />
               </div>
               <div className="flex items-end pb-2">
                 <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={count} onChange={e => setCount(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-medium text-slate-700">$count</span>
                 </label>
               </div>
            </div>

          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">请先选择一个 EntitySet</div>
        )}
      </div>

      {/* 右侧结果面板 */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        {/* URL 预览区 */}
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
           <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm text-slate-800">Generated URL</h2>
              <div className="flex gap-2">
                 <button onClick={copyToClipboard} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition" title="复制链接">
                    <Copy className="w-4 h-4" />
                 </button>
              </div>
           </div>
           <div className="bg-slate-800 rounded-md p-3 relative group">
              <code className="text-xs font-mono text-green-400 break-all whitespace-pre-wrap block">
                {displayUrl}
              </code>
           </div>
           <div className="mt-4 flex justify-end">
              <button 
                onClick={executeQuery} 
                disabled={loading || !generatedUrl}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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

        {/* 结果 JSON */}
        <div className="flex-1 overflow-auto p-4">
           {error ? (
             <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0"><X className="w-4 h-4" /></div>
                <div className="whitespace-pre-wrap font-mono break-all">{error}</div>
             </div>
           ) : result ? (
             <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 flex justify-between">
                   <span>Response Preview</span>
                   {result['@odata.count'] && <span className="text-indigo-600">Count: {result['@odata.count']}</span>}
                   {Array.isArray(result.value) && <span className="text-slate-400">{result.value.length} items</span>}
                </div>
                <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[calc(100vh-300px)]">
                  {JSON.stringify(result, null, 2)}
                </pre>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <Play className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">点击 "Run Query" 查看结果</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default QueryBuilder;