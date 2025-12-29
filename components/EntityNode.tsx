import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Box, ArrowRightLeft, Table2, Braces } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeData {
  entity: ODataEntity;
}

const EntityNode = ({ data }: { data: EntityNodeData }) => {
  const { entity } = data;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    <div className="relative min-w-[220px] max-w-[320px] font-sans text-xs shadow-xl rounded-lg bg-white border border-slate-200 group/node">
      
      {/* 
         全局输入点 (Target)
         位于节点左侧顶部（Header附近），作为所有进入该节点连线的终点。
         ID="target-input" 供 ERDiagram 引用。
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target-input"
        className="!w-3 !h-3 !bg-indigo-600 !border-2 !border-white !rounded-full !-left-[6px] top-8 transition-transform hover:scale-125 z-50" 
      />

      {/* 标题栏 */}
      <div className="bg-slate-800 p-2.5 rounded-t-lg flex justify-between items-center text-white border-b border-slate-700">
          <div className="flex items-center gap-2 overflow-hidden">
              <Table2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="font-bold text-sm tracking-wide truncate" title={entity.name}>
              {entity.name}
              </span>
          </div>
          {entity.navigationProperties.length > 0 && (
              <span className="text-[10px] bg-slate-700 px-1.5 rounded text-slate-300 font-mono">
                  {entity.navigationProperties.length} rels
              </span>
          )}
      </div>

      {/* 内容区域 */}
      <div className="divide-y divide-slate-100">
          
          {/* 主键区域 */}
          {keyProperties.length > 0 && (
            <div className="bg-amber-50/60">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 group hover:bg-amber-100/50 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden text-amber-900">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-600" />
                        <span className="font-bold truncate text-slate-800">{prop.name}</span>
                    </div>
                    <span className="text-[10px] text-amber-600/80 font-mono ml-2">PK</span>
                </div>
            ))}
            </div>
          )}

          {/* 普通属性区域 */}
          <div className="bg-white max-h-[160px] overflow-y-auto custom-scrollbar">
            {otherProperties.map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 group transition-colors">
                <span className="truncate mr-2 text-slate-600 group-hover:text-slate-900" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 group-hover:text-slate-500">{prop.type.split('.').pop()}</span>
            </div>
            ))}
          </div>

          {/* 
            导航属性区域 (Navigation Properties)
            这里每一行都会放置一个 Source Handle，对应图中的红色连线起点。
          */}
          {entity.navigationProperties.length > 0 && (
            <div className="bg-slate-50/80 border-t border-slate-200 pb-1">
            {entity.navigationProperties.map((nav) => {
                const isCollection = nav.type.includes('Collection(');
                return (
                <div key={nav.name} className="relative flex items-center justify-between px-3 py-1.5 hover:bg-indigo-50 transition-colors cursor-default group/item">
                    {/* 
                        !!! 关键点 !!!
                        每个属性行右侧都有一个专属的 Source Handle。
                        ID = nav.name (属性名)
                    */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={nav.name}
                        className="!w-2 !h-2 !bg-indigo-500 !border-2 !border-white !rounded-full !-right-[5px] top-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity z-50"
                    />
                    
                    <div className="flex items-center gap-2 truncate">
                    <Braces className="w-3 h-3 flex-shrink-0 text-slate-400 group-hover/item:text-indigo-500" />
                    <span className="truncate font-medium text-xs text-indigo-700" title={nav.name}>{nav.name}</span>
                    </div>
                    {isCollection && <span className="text-[9px] bg-white border border-indigo-200 text-indigo-600 px-1 rounded-sm font-mono shadow-sm">1:N</span>}
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
