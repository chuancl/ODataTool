import React from 'react';
import { ChevronDown, Check, Plus, Filter, ArrowUpDown } from 'lucide-react';
import { ODataSchema, ODataEntity } from '../../types';

interface SidebarProps {
    schema: ODataSchema;
    selectedSet: string;
    onSetChange: (val: string) => void;
    currentEntity: ODataEntity | null | undefined;
    selectedProps: Set<string>;
    onPropChange: (set: Set<string>) => void;
    expandProps: Set<string>;
    onExpandChange: (set: Set<string>) => void;
    filter: string;
    onFilterChange: (val: string) => void;
    orderBy: string;
    onOrderByChange: (val: string) => void;
    orderByDir: 'asc' | 'desc';
    onOrderByDirChange: (val: 'asc' | 'desc') => void;
    top: number | '';
    onTopChange: (val: number | '') => void;
    skip: number | '';
    onSkipChange: (val: number | '') => void;
    count: boolean;
    onCountChange: (val: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    schema, selectedSet, onSetChange, currentEntity,
    selectedProps, onPropChange,
    expandProps, onExpandChange,
    filter, onFilterChange,
    orderBy, onOrderByChange,
    orderByDir, onOrderByDirChange,
    top, onTopChange,
    skip, onSkipChange,
    count, onCountChange
}) => {

    const toggleSelection = (set: Set<string>, val: string, updater: (newSet: Set<string>) => void) => {
        const newSet = new Set(set);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        updater(newSet);
    };

    return (
        <div className="w-[360px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            {/* EntitySet Select */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">EntitySet</label>
                <div className="relative">
                    <select 
                        value={selectedSet} 
                        onChange={e => onSetChange(e.target.value)}
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
                                onClick={() => onPropChange(new Set(selectedProps.size === 0 ? currentEntity.properties.map(p=>p.name) : []))}
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
                                        onChange={() => toggleSelection(selectedProps, p.name, onPropChange)}
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
                                            onChange={() => toggleSelection(expandProps, np.name, onExpandChange)}
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
                                onChange={e => onFilterChange(e.target.value)}
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
                                    onChange={e => onOrderByChange(e.target.value)}
                                >
                                    <option value="">(无排序)</option>
                                    {currentEntity.properties.map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                                <select 
                                    className="w-20 px-2 py-1.5 border border-slate-300 rounded text-xs outline-none bg-white shadow-sm"
                                    value={orderByDir}
                                    onChange={e => onOrderByDirChange(e.target.value as 'asc' | 'desc')}
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
                                onChange={e => onTopChange(e.target.value ? Number(e.target.value) : '')}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">$skip</label>
                            <input 
                                type="number" 
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                                placeholder="0"
                                value={skip}
                                onChange={e => onSkipChange(e.target.value ? Number(e.target.value) : '')}
                            />
                        </div>
                        <div className="col-span-2 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <input type="checkbox" checked={count} onChange={e => onCountChange(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">是否返回内联计数 ($inlinecount/$count)</span>
                            </label>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-slate-400 text-xs">请先选择一个 EntitySet</div>
            )}
        </div>
    );
};

export default Sidebar;