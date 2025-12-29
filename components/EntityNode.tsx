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
    <div className="shadow-2xl rounded-md overflow-hidden border border-slate-600 bg-slate-800 min-w-[200px] max-w-[280px] font-sans text-xs relative group">
      {/* 
        修复核心问题：
        1. 仅保留 Left (Target) 和 Right (Source) 以匹配从左到右的布局。
        2. 移除 id 属性，使其成为默认 Handle，这样 Edge 不需要指定 sourceHandle/targetHandle 即可自动连接。
        3. 增加 !w-2 !h-2 等样式，虽然设置为透明，但确保有点击/连接区域。
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-slate-400 !w-1 !h-4 !rounded-sm !border-none -ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-slate-400 !w-1 !h-4 !rounded-sm !border-none -mr-0.5 opacity-0 group-hover:opacity-100 transition-opacity" 
      />

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
