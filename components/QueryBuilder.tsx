import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Copy, Check, Filter, ArrowUpDown, Plus, X, ChevronRight, ChevronDown, Table as TableIcon, Code, FileJson, FileCode, ArrowLeft, CornerDownRight, Braces, List } from 'lucide-react';
import { ODataSchema, ODataEntity } from '../types';

interface QueryBuilderProps {
  schema: ODataSchema;
  metadataUrl: string;
}

// --- 工具函数 ---

// 标准化 OData 响应数据 (兼容 V2 d.results 和 V4 value)
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

// 简单的 XML 格式化工具
const formatXml = (xml: string) => {
    let formatted = '';
    const reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    xml.split('\r\n').forEach((node) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        } else if (node.match(/^<\/\w/)) {
            if (pad !== 0) pad -= 1;
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        } else {
            indent = 0;
        }

        let padding = '';
        for (let i = 0; i < pad; i++) {
            padding += '  ';
        }

        formatted += padding + node + '\r\n';
        pad += indent;
    });
    return formatted;
};

// --- 组件定义 ---

// JSON 树节点组件
const JsonNode: React.FC<{ name?: string; value: any; isLast?: boolean; level?: number }> = ({ name, value, isLast, level = 0 }) => {
    const [expanded, setExpanded] = useState(true);
    
    // 基础类型渲染
    if (value === null) return (
        <div className="font-mono text-xs leading-5">
            {name && <span className="text-slate-700 mr-1">"{name}":</span>}
            <span className="text-slate-400">null</span>
            {!isLast && <span className="text-slate-500">,</span>}
        </div>
    );

    if (typeof value === 'boolean') return (
        <div className="font-mono text-xs leading-5">
             {name && <span className="text-slate-700 mr-1">"{name}":</span>}
             <span className="text-purple-600 font-bold">{String(value)}</span>
             {!isLast && <span className="text-slate-500">,</span>}
        </div>
    );

    if (typeof value === 'number') return (
        <div className="font-mono text-xs leading-5">
             {name && <span className="text-slate-700 mr-1">"{name}":</span>}
             <span className="text-blue-600">{value}</span>
             {!isLast && <span className="text-slate-500">,</span>}
        </div>
    );

    if (typeof value === 'string') return (
        <div className="font-mono text-xs leading-5 whitespace-pre-wrap break-all">
             {name && <span className="text-slate-700 mr-1">"{name}":</span>}
             <span className="text-green-600">"{value}"</span>
             {!isLast && <span className="text-slate-500">,</span>}
        </div>
    );

    // 复杂类型 (Object / Array)
    const isArray = Array.isArray(value);
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;
    const openBracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';
    const itemCount = isArray ? value.length : keys.length;

    if (isEmpty) return (
        <div className="font-mono text-xs leading-5">
            {name && <span className="text-slate-700 mr-1">"{name}":</span>}
            <span className="text-slate-600">{openBracket}{closeBracket}</span>
            {!isLast && <span className="text-slate-500">,</span>}
        </div>
    );

    return (
        <div className="font-mono text-xs leading-5">
            <div className="flex items-start">
                {/* Toggle Button */}
                <button 
                    onClick={() => setExpanded(!expanded)} 
                    className="mr-1 mt-0.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Key & Open Bracket */}
                <div className="flex-1">
                    {name && <span className="text-slate-700 mr-1">"{name}":</span>}
                    <span className="text-slate-600">{openBracket}</span>
                    
                    {!expanded && (
                        <span className="text-slate-400 mx-1 cursor-pointer select-none" onClick={() => setExpanded(true)}>
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}...
                        </span>
                    )}

                    {/* Children */}
                    {expanded && (
                        <div className="pl-4 border-l border-slate-100 ml-1">
                            {keys.map((key, idx) => (
                                <JsonNode 
                                    key={key} 
                                    name={isArray ? undefined : key} 
                                    value={value[key]} 
                                    isLast={idx === keys.length - 1} 
                                    level={level + 1}
                                />
                            ))}
                        </div>
                    )}

                    {/* Close Bracket */}
                    <div className={expanded ? "" : "inline"}>
                        <span className="text-slate-600">{closeBracket}</span>
                        {!isLast && <span className="text-slate-500">,</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 表格渲染组件
const DataTable: React.FC<{ data: any; onDrillDown: (key: string, val: any) => void }> = ({ data, onDrillDown }) => {
    // 规范化后的数据可能是数组，也可能是单个对象
    if (Array.isArray(data)) {
        if (data.length === 0) return <div className="p-8 text-center text-slate-400 text-xs italic flex flex-col items-center"><List className="w-8 h-8 mb-2 opacity-20"/>无数据 (Empty Array)</div>;
        
        // 提取列名
        const firstRow = data[0];
        // 如果数组元素是原始类型（如 string[]），特殊处理
        const isPrimitiveArray = typeof firstRow !== 'object' || firstRow === null;

        if (isPrimitiveArray) {
             return (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 border border-slate-200 w-12 text-center font-mono">Index</th>
                                <th className="p-2 border border-slate-200 font-semibold">Value</th>
                            </tr>
                        </thead>
                         <tbody>
                            {data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 border border-slate-200 text-center text-slate-400 font-mono select-none">{idx}</td>
                                    <td className="p-2 border border-slate-200 font-mono text-slate-700">
                                         <DataCell value={row} colName="value" onDrill={() => {}} />
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                    </table>
                </div>
             )
        }

        const columns = Array.from(new Set(data.slice(0, 10).flatMap(Object.keys)));

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-max">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-2 border border-slate-200 w-10 text-center font-mono bg-slate-50">#</th>
                            {columns.map(col => (
                                <th key={col} className="p-2 border border-slate-200 font-semibold whitespace-nowrap bg-slate-50">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-2 border border-slate-200 text-center text-slate-400 font-mono select-none bg-white group-hover:bg-slate-50">{idx + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="p-2 border border-slate-200 font-mono text-slate-700 whitespace-nowrap max-w-[250px] overflow-hidden text-ellipsis">
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
            <div className="overflow-x-auto p-4 flex justify-center">
                 <table className="w-full max-w-3xl text-left border-collapse text-xs shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                    <tbody>
                        {Object.entries(data).map(([key, val]) => (
                            <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-semibold text-slate-600 w-1/3 bg-slate-50/50 border-r border-slate-100">{key}</td>
                                <td className="py-2.5 px-4 font-mono text-slate-700 bg-white">
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

// 单元格渲染
const DataCell: React.FC<{ value: any; colName: string; onDrill: () => void }> = ({ value, colName, onDrill }) => {
    if (value === null || value === undefined) return <span className="text-slate-300 italic">null</span>;
    
    if (Array.isArray(value)) {
        return (
            <button onClick={onDrill} className="flex items-center gap-1.5 text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded transition border border-transparent hover:border-indigo-100">
                <TableIcon className="w-3 h-3" />
                <span className="font-semibold">{value.length}</span>
                <span className="opacity-70">items</span>
                <ChevronRight className="w-3 h-3 opacity-50 ml-0.5" />
            </button>
        );
    }
    
    if (typeof value === 'object') {
        return (
             <button onClick={onDrill} className="flex items-center gap-1.5 text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded transition border border-transparent hover:border-indigo-100">
                <Braces className="w-3 h-3" />
                <span>Object</span>
                <ChevronRight className="w-3 h-3 opacity-50 ml-0.5" />
            </button>
        );
    }
    
    const str = String(value);
    if (str.startsWith('http')) {
        return <a href={str} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1" onClick={e=>e.stopPropagation()}>{str}</a>
    }

    // Bool / Number highlighting
    if (typeof value === 'boolean') return <span className="text-purple-600 font-bold">{str}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{str}</span>;

    return <span className="truncate block" title={str}>{str}</span>;
}


const QueryBuilder: React.FC<QueryBuilderProps> = ({ schema, metadataUrl }) => {
  // 基础 URL
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
  const [reqFormat, setReqFormat] = useState<'json' | 'xml'>('json');
  const [viewMode, setViewMode] = useState<'code' | 'table'>('code');
  
  // Result State
  const [resultData, setResultData] = useState<any>(null); // JSON 对象
  const [resultText, setResultText] = useState<string>(''); // XML 文本
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill Down Stack
  const [drillStack, setDrillStack] = useState<Array<{ title: string, data: any }>>([]);

  const isMounted = useRef(false);

  // 初始化 EntitySet
  useEffect(() => {
    if (schema.entitySets.length > 0 && !selectedSet) {
      setSelectedSet(schema.entitySets[0].name);
    }
  }, [schema]);

  const currentEntity = useMemo(() => {
    const setDef = schema.entitySets.find(s => s.name === selectedSet);
    if (!setDef) return null;
    const typeName = setDef.entityType.split('.').pop(); 
    return schema.entities.find(e => e.name === typeName || e.name === setDef.entityType);
  }, [selectedSet, schema]);

  // 切换 EntitySet 重置状态
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

  // 生成 URL
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
    
    if (count) {
        const isV4 = schema.version && schema.version.startsWith('4');
        if (isV4) params.append('$count', 'true');
        else params.append('$inlinecount', 'allpages');
    }

    const queryString = params.toString();
    return `${serviceRoot}/${selectedSet}${queryString ? '?' + queryString : ''}`;
  }, [serviceRoot, selectedSet, selectedProps, expandProps, filter, orderBy, orderByDir, top, skip, count, currentEntity, schema.version]);

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
    setDrillStack([]);

    try {
      const headers: any = {};
      if (reqFormat === 'xml') {
          headers['Accept'] = 'application/atom+xml, application/xml, text/xml';
      } else {
          headers['Accept'] = 'application/json, application/json;odata.metadata=minimal';
      }

      const res = await fetch(generatedUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      
      const text = await res.text();
      
      if (reqFormat === 'json') {
          try {
              const json = JSON.parse(text);
              setResultData(json);
          } catch (e) {
              setResultText(text);
              // 如果返回了 XML，自动切到 XML 模式
              if (text.trim().startsWith('<')) {
                  setReqFormat('xml');
                  throw new Error("服务器返回了 XML 数据，已自动切换到文本视图。");
              } else {
                  throw new Error("无法解析 JSON 响应: " + text.substring(0, 50));
              }
          }
      } else {
          setResultText(text);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 格式切换时自动查询
  useEffect(() => {
      if (isMounted.current && generatedUrl) {
          executeQuery();
      }
      isMounted.current = true;
  }, [reqFormat]);

  const handleDrillDown = (key: string, data: any) => {
      setDrillStack(prev => [...prev, { title: key, data }]);
  };

  const handleDrillUp = (index: number) => {
      if (index === -1) {
          setDrillStack([]);
      } else {
          setDrillStack(prev => prev.slice(0, index + 1));
      }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(displayUrl);
  };

  // Table Data 计算
  const currentTableData = useMemo(() => {
      // 1. 如果有 DrillDown 栈，显示栈顶数据
      if (drillStack.length > 0) {
          return normalizeODataResponse(drillStack[drillStack.length - 1].data);
      }
      // 2. 否则显示主结果
      if (resultData) {
          return normalizeODataResponse(resultData);
      }
      return [];
  }, [resultData, drillStack]);

  if (!schema.entitySets.length) {
    return <div className="p-8 text-center text-slate-500">此 OData 服务未定义 EntitySets，无法构建查询。</div>;
  }

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* --- 左侧配置面板 (Sidebar) --- */}
      <div className="w-[360px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* EntitySet Select */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">EntitySet</label>
          <div className="relative">
            <select 
              value={selectedSet} 
              onChange={e => setSelectedSet(e.target.value)}
              className="w-full p-2 pl-3 pr-8 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none shadow-sm"
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
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50 grid grid-cols-1 gap-0.5 shadow-inner">
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
                <div className="border border-slate-200 rounded-md p-2 bg-slate-50 flex flex-wrap gap-2 shadow-inner">
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"
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
                      className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none bg-white shadow-sm"
                      value={orderBy}
                      onChange={e => setOrderBy(e.target.value)}
                    >
                      <option value="">(无排序)</option>
                      {currentEntity.properties.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <select 
                      className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none bg-white shadow-sm"
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
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                    placeholder="All"
                    value={top}
                    onChange={e => setTop(e.target.value ? Number(e.target.value) : '')}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">$skip</label>
                  <input 
                    type="number" 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
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

      {/* --- 右侧结果面板 --- */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden min-w-0">
        {/* Header Control Area */}
        <div className="bg-white border-b border-slate-200 shadow-sm z-10 p-4 shrink-0">
           {/* URL & Copy */}
           <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                 生成链接
                 <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">GET</span>
              </h2>
              <button onClick={copyToClipboard} className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition px-2 py-1 rounded hover:bg-slate-50">
                 <Copy className="w-3.5 h-3.5" /> 复制
              </button>
           </div>
           
           {/* URL Input Box */}
           <div className="bg-slate-800 rounded-md p-3 relative group mb-4 shadow-inner">
              <code className="text-xs font-mono text-green-400 break-all whitespace-pre-wrap block max-h-24 overflow-y-auto custom-scrollbar">
                {displayUrl}
              </code>
           </div>

           {/* Toolbar */}
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

        {/* Result Area */}
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
                            <div className="h-full w-full overflow-auto bg-white">
                                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 flex justify-between sticky top-0 z-10 shadow-sm">
                                    <span>JSON Response</span>
                                    {/* Fix: Check resultData before access */}
                                    {resultData && resultData['@odata.count'] && <span className="text-indigo-600">Total Count: {resultData['@odata.count']}</span>}
                                </div>
                                <div className="p-4">
                                     <JsonNode value={resultData} />
                                </div>
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
                        // XML View
                        <div className="h-full w-full overflow-auto bg-white">
                            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 sticky top-0 z-10 shadow-sm">
                                <span>XML / Atom Response</span>
                            </div>
                            <pre className="p-4 text-xs font-mono text-slate-700 w-full whitespace-pre-wrap break-all leading-normal">
                                {formatXml(resultText)}
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