import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Box, ArrowRightLeft, Table2 } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeData {
  entity: ODataEntity;
}

const EntityNode = ({ data }: { data: EntityNodeData }) => {
  const { entity } = data;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    <div className="relative group min-w-[200px] max-w-[300px] font-sans text-xs">
      
      {/* 
         !!! 核心修复 !!! 
         移除 id 属性。
         React Flow 默认 Edge 寻找没有 id 的 Handle。
         左侧作为输入 (Target)，右侧作为输出 (Source)。
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-full !-left-1.5 top-1/2 transition-opacity z-50 hover:scale-125" 
      />
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-full !-right-1.5 top-1/2 transition-opacity z-50 hover:scale-125" 
      />

      <div className="bg-white rounded-lg shadow-lg border-2 border-slate-200 overflow-hidden hover:border-blue-500 hover:shadow-xl transition-all duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-2 flex justify-between items-center text-white border-b border-slate-600">
            <div className="flex items-center gap-2 overflow-hidden">
                <Table2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="font-bold text-sm truncate" title={entity.name}>
                {entity.name}
                </span>
            </div>
        </div>

        {/* Keys */}
        {keyProperties.length > 0 && (
            <div className="bg-amber-50/50 border-b border-amber-100/50">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2 overflow-hidden text-amber-900">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-600" />
                        <span className="font-bold truncate">{prop.name}</span>
                    </div>
                    <span className="text-[9px] text-amber-600/70 font-mono ml-2 border border-amber-200 px-1 rounded">PK</span>
                </div>
            ))}
            </div>
        )}

        {/* Properties */}
        <div className="bg-white text-slate-700 max-h-[150px] overflow-y-auto custom-scrollbar">
            {otherProperties.map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-3 py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 group/item">
                <span className="truncate mr-2 group-hover/item:text-slate-900 transition-colors" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{prop.type.split('.').pop()}</span>
            </div>
            ))}
        </div>

        {/* Navigation */}
        {entity.navigationProperties.length > 0 && (
            <div className="bg-slate-50 text-slate-700 border-t border-slate-200">
            {entity.navigationProperties.map((nav) => {
                const isCollection = nav.type.includes('Collection(');
                return (
                <div key={nav.name} className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200/50 last:border-0 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center gap-2 truncate">
                    <ArrowRightLeft className="w-3 h-3 flex-shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-xs text-blue-700" title={nav.name}>{nav.name}</span>
                    </div>
                    {isCollection && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-mono">1:N</span>}
                </div>
                );
            })}
            </div>
        )}
      </div>
    </div>
  );
};

export default memo(EntityNode);
