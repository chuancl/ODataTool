import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Key, Table2, Braces } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeData {
  entity: ODataEntity;
}

const EntityNode = ({ data }: { data: EntityNodeData }) => {
  const { entity } = data;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    <div className="relative min-w-[220px] max-w-[320px] font-sans text-xs shadow-md rounded-md bg-white border border-slate-300 group/node transition-shadow hover:shadow-xl hover:border-slate-400">
      
      {/* 
         全局输入点 (Target) - 移至左侧垂直居中
         这对于 'step' (直角) 类型的连线非常重要，可以避免线头扎堆
      */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target-input"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white !rounded-sm !-left-[7px] z-50 shadow-sm transition-transform hover:scale-125" 
      />

      {/* 标题栏 - 颜色加深，更像数据库表头 */}
      <div className="bg-slate-700 p-2 rounded-t-md flex justify-between items-center text-white border-b border-slate-600">
          <div className="flex items-center gap-2 overflow-hidden">
              <Table2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <span className="font-bold text-sm tracking-wide truncate" title={entity.name}>
              {entity.name}
              </span>
          </div>
          {entity.navigationProperties.length > 0 && (
              <span className="text-[10px] bg-slate-600 px-1.5 rounded text-slate-200 font-mono">
                  {entity.navigationProperties.length}
              </span>
          )}
      </div>

      {/* 内容区域 */}
      <div className="divide-y divide-slate-100">
          
          {/* 主键区域 */}
          {keyProperties.length > 0 && (
            <div className="bg-amber-50/50">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 border-l-2 border-amber-400">
                    <div className="flex items-center gap-2 overflow-hidden text-slate-700">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-500" />
                        <span className="font-bold truncate">{prop.name}</span>
                    </div>
                    <span className="text-[10px] text-amber-600/70 font-mono ml-2">PK</span>
                </div>
            ))}
            </div>
          )}

          {/* 普通属性 */}
          <div className="bg-white max-h-[160px] overflow-y-auto custom-scrollbar">
            {otherProperties.map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 transition-colors">
                <span className="truncate mr-2 text-slate-600" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{prop.type.split('.').pop()}</span>
            </div>
            ))}
          </div>

          {/* 导航属性 - 增加颜色区分 */}
          {entity.navigationProperties.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 pb-1">
            {entity.navigationProperties.map((nav) => {
                const isCollection = nav.type.includes('Collection(');
                // 1:N 用蓝色，1:1 用绿色
                const itemColorClass = isCollection ? "text-blue-600" : "text-emerald-600";
                const handleColorClass = isCollection ? "!bg-blue-500" : "!bg-emerald-500";
                const iconColorClass = isCollection ? "text-blue-400 group-hover/item:text-blue-600" : "text-emerald-400 group-hover/item:text-emerald-600";

                return (
                <div key={nav.name} className="relative flex items-center justify-between px-3 py-1.5 hover:bg-white hover:shadow-inner transition-colors cursor-default group/item">
                    {/* Source Handle */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={nav.name}
                        className={`!w-2.5 !h-2.5 ${handleColorClass} !border-2 !border-white !rounded-full !-right-[6px] top-1/2 opacity-60 group-hover/item:opacity-100 transition-opacity z-50 shadow-sm`}
                    />
                    
                    <div className="flex items-center gap-2 truncate">
                    <Braces className={`w-3 h-3 flex-shrink-0 ${iconColorClass}`} />
                    <span className={`truncate font-medium text-xs ${itemColorClass}`} title={nav.name}>{nav.name}</span>
                    </div>
                    {isCollection && <span className="text-[9px] bg-blue-50 border border-blue-100 text-blue-600 px-1 rounded-sm font-mono">1:N</span>}
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
