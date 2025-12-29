import React from 'react';
import { Table as TableIcon, ChevronRight, Braces, List, Image as ImageIcon, Film, Binary } from 'lucide-react';
import { cleanBase64 } from './utils';

// --- DataCell Component ---
interface DataCellProps {
    value: any;
    colName: string;
    dataType?: string;
    onDrill: () => void;
}

const DataCell: React.FC<DataCellProps> = ({ value, colName, dataType, onDrill }) => {
    if (value === null || value === undefined) return <span className="text-slate-300 italic">null</span>;
    
    // 数组
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
    
    // 对象
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

    // 1. 已知的 Base64 图片 Prefix (data:image/...)
    if (str.startsWith('data:image/')) {
        return (
            <div className="group relative inline-block">
                <img src={str} alt="Base64 Preview" className="h-12 w-auto object-contain border border-slate-200 rounded bg-slate-50 hover:scale-[3] hover:shadow-xl hover:z-50 transition-all origin-left" />
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[100px]">{str.substring(0, 20)}...</span>
            </div>
        );
    }

    // 2. URL 图片/视频检测
    if (str.startsWith('http') || str.startsWith('/')) {
        const lowerStr = str.toLowerCase();
        const isImg = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(lowerStr);
        const isVideo = /\.(mp4|webm|ogg|mov)$/.test(lowerStr);

        if (isImg) {
            return (
                <div className="flex flex-col items-start gap-1">
                    <a href={str} target="_blank" rel="noreferrer" className="block relative group">
                         <img src={str} alt="Preview" className="h-16 max-w-[150px] object-cover border border-slate-200 rounded shadow-sm group-hover:opacity-90" />
                         <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition rounded text-white">
                             <ImageIcon className="w-4 h-4" />
                         </div>
                    </a>
                    <a href={str} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] truncate max-w-[150px] block" onClick={e=>e.stopPropagation()}>{str}</a>
                </div>
            )
        }
        
        if (isVideo) {
             return (
                <div className="flex flex-col items-start gap-1">
                    <div className="relative border border-slate-200 rounded bg-black overflow-hidden shadow-sm max-w-[200px]">
                         <video src={str} controls className="h-24 w-auto object-contain" />
                    </div>
                     <a href={str} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] truncate max-w-[200px] flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                        <Film className="w-3 h-3" /> {str}
                     </a>
                </div>
            )
        }
        // 普通链接
        return <a href={str} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 break-all" onClick={e=>e.stopPropagation()}>{str}</a>
    }

    // 3. Edm.Binary 或 疑似 Base64 图片 (包含 Northwind OLE 处理)
    // 如果明确是 Binary 类型，或者字符串很长且像 Base64
    const isExplicitBinary = dataType === 'Edm.Binary';
    const looksLikeBase64 = str.length > 100 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 50));

    if (isExplicitBinary || looksLikeBase64) {
        const { src, isImage } = cleanBase64(str);
        
        // 如果检测到有效的图片头，直接渲染
        if (isImage) {
            return (
                <div className="group relative inline-block">
                    <img src={src} alt="Binary Image" className="h-16 w-auto object-contain border border-slate-200 rounded bg-slate-50 hover:scale-[3] hover:shadow-xl hover:z-50 transition-all origin-left" />
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Image ({Math.round(str.length / 1024)} KB)</span>
                </div>
            );
        }

        // 如果是 Binary 但没检测到已知头，提供一个按钮尝试强制渲染
        // 特别是针对 Northwind 这种 legacy OLE，如果 cleanBase64 失败，我们也允许用户尝试
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono border px-1.5 py-0.5 rounded bg-slate-50">Binary ({Math.round(str.length / 1024)} KB)</span>
                <button 
                    onClick={(e) => {
                        // 强制在新窗口打开 base64
                        const w = window.open("");
                        if (w) {
                            w.document.write(`<img src="${src}" />`);
                        }
                    }}
                    className="text-[10px] text-indigo-600 hover:underline"
                    title="Try to view as image"
                >
                    View Image
                </button>
            </div>
        );
    }

    // Bool / Number highlighting
    if (typeof value === 'boolean') return <span className="text-orange-600 font-bold">{str}</span>;
    if (typeof value === 'number') return <span className="text-blue-600">{str}</span>;

    // 普通文本
    return <span className="truncate block max-w-md" title={str}>{str}</span>;
}

// --- DataTable Component ---
interface DataTableProps {
    data: any; 
    onDrillDown: (key: string, val: any) => void;
    columnTypes?: Map<string, string>; // 可选：列的类型定义
}

const DataTable: React.FC<DataTableProps> = ({ data, onDrillDown, columnTypes }) => {
    // 规范化后的数据可能是数组，也可能是单个对象
    if (Array.isArray(data)) {
        if (data.length === 0) return <div className="p-8 text-center text-slate-400 text-xs italic flex flex-col items-center"><List className="w-8 h-8 mb-2 opacity-20"/>无数据 (Empty Array)</div>;
        
        const firstRow = data[0];
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
                                <th key={col} className="p-2 border border-slate-200 font-semibold whitespace-nowrap bg-slate-50">
                                    <div className="flex items-center gap-1">
                                        {col}
                                        {columnTypes?.get(col) === 'Edm.Binary' && (
                                            <span title="Binary Data">
                                                <Binary className="w-3 h-3 text-slate-400" />
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-2 border border-slate-200 text-center text-slate-400 font-mono select-none bg-white group-hover:bg-slate-50">{idx + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="p-2 border border-slate-200 font-mono text-slate-700 whitespace-nowrap max-w-[400px] overflow-hidden text-ellipsis align-top">
                                        <DataCell 
                                            value={row[col]} 
                                            colName={col} 
                                            dataType={columnTypes?.get(col)}
                                            onDrill={() => onDrillDown(`${idx}.${col}`, row[col])} 
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    } else if (typeof data === 'object' && data !== null) {
        return (
            <div className="overflow-x-auto p-4 flex justify-center">
                 <table className="w-full max-w-4xl text-left border-collapse text-xs shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                    <tbody>
                        {Object.entries(data).map(([key, val]) => (
                            <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="py-3 px-4 font-semibold text-slate-600 w-1/4 bg-slate-50/50 border-r border-slate-100">
                                    <div className="flex items-center gap-1">
                                        {key}
                                        {columnTypes?.get(key) === 'Edm.Binary' && <Binary className="w-3 h-3 text-slate-400" />}
                                    </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-700 bg-white">
                                     <DataCell 
                                        value={val} 
                                        colName={key} 
                                        dataType={columnTypes?.get(key)}
                                        onDrill={() => onDrillDown(key, val)} 
                                     />
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

export default DataTable;