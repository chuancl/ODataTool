import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Box, ArrowRightLeft } from 'lucide-react';
import { ODataEntity } from '../types';

// 定义传入节点的数据结构
interface EntityNodeData {
  entity: ODataEntity;
}

const EntityNode = ({ data }: { data: EntityNodeData }) => {
  const { entity } = data;

  // 区分普通属性和主键
  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    <div className="shadow-2xl rounded-md overflow-hidden border border-slate-600 bg-slate-800 min-w-[200px] max-w-[280px] font-sans text-xs">
      {/* React Flow Handles - 设置为不可见，分布在四周以实现自动连线优化 */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-none" id="l" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-none" id="r" />

      {/* 1. 标题栏 (Header) */}
      <div className="bg-slate-700 p-2 border-b border-slate-600 flex justify-between items-center">
        <span className="font-bold text-slate-100 text-sm truncate" title={entity.name}>
          {entity.name}
        </span>
        <Box className="w-3 h-3 text-slate-400" />
      </div>

      {/* 2. 主键区 (Keys) - 橙色高亮 */}
      {keyProperties.length > 0 && (
        <div className="bg-amber-600/90 text-white">
          {keyProperties.map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-2 py-1.5 border-b border-amber-700/50 last:border-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <Key className="w-3 h-3 flex-shrink-0 fill-current" />
                <span className="font-bold truncate">{prop.name}</span>
              </div>
              <span className="text-[10px] opacity-80 font-mono flex-shrink-0 ml-2">{prop.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. 普通属性区 (Properties) - 深色背景 */}
      <div className="bg-slate-800 text-slate-300">
        {otherProperties.slice(0, 8).map((prop) => ( // 限制显示数量防止过长
          <div key={prop.name} className="flex items-center justify-between px-2 py-1 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/50 transition-colors">
            <span className="truncate mr-2" title={prop.name}>{prop.name}</span>
            <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{prop.type}</span>
          </div>
        ))}
        {otherProperties.length > 8 && (
          <div className="px-2 py-1 text-center text-[10px] text-slate-500 italic bg-slate-900/30">
            ... {otherProperties.length - 8} more properties
          </div>
        )}
      </div>

      {/* 4. 导航属性区 (Navigation Props) - 蓝色高亮 */}
      {entity.navigationProperties.length > 0 && (
        <div className="bg-sky-600 text-white border-t border-slate-600">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-70 bg-sky-700">
            Navigation
          </div>
          {entity.navigationProperties.map((nav) => {
             const isCollection = nav.type.includes('Collection(');
             const displayType = nav.type.split('.').pop()?.replace(')', '') || nav.type;
             
             return (
              <div key={nav.name} className="flex items-center justify-between px-2 py-1.5 border-b border-sky-500/50 last:border-0 hover:bg-sky-500 transition-colors">
                <div className="flex items-center gap-1.5 truncate">
                  <ArrowRightLeft className="w-3 h-3 flex-shrink-0 opacity-70" />
                  <span className="truncate" title={nav.name}>{nav.name}</span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                    {isCollection && <span className="text-[9px] bg-sky-800 px-1 rounded text-sky-100">1:N</span>}
                    <span className="text-[10px] opacity-90 font-mono">{displayType}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(EntityNode);
