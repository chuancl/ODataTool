import React from 'react';
import { Key, Table2, Braces } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  node?: any; // X6 注入的 node 实例
  entity?: ODataEntity; // 如果直接传 props
}

const EntityNode: React.FC<EntityNodeProps> = ({ node, entity: propEntity }) => {
  // 从 X6 node data 中获取数据
  const entity: ODataEntity = node ? node.getData()?.entity : propEntity;

  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));

  return (
    <div className="w-full h-full font-sans text-xs shadow-lg rounded-md bg-white border border-slate-300 flex flex-col overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all select-none">
      
      {/* 标题栏 - 可作为被连线的统一入口 (target) */}
      <div 
        className="bg-slate-700 p-2 flex justify-between items-center text-white border-b border-slate-600 cursor-move"
      >
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
      <div className="flex-1 overflow-hidden bg-white flex flex-col">
          
          {/* 主键区域 */}
          {keyProperties.length > 0 && (
            <div className="bg-amber-50/50 flex-shrink-0">
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
          <div className="bg-white overflow-hidden flex-shrink-0">
            {otherProperties.slice(0, 10).map((prop) => (
            <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 border-l-2 border-transparent hover:bg-slate-50 transition-colors">
                <span className="truncate mr-2 text-slate-600" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{prop.type.split('.').pop()}</span>
            </div>
            ))}
            {otherProperties.length > 10 && (
                <div className="px-3 py-1 text-center text-[10px] text-slate-400 bg-slate-50">
                    ... {otherProperties.length - 10} more properties
                </div>
            )}
          </div>

          {/* 导航属性 - 设为连线源头 (Source) */}
          {entity.navigationProperties.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 pb-1 flex-1 overflow-auto">
            {entity.navigationProperties.map((nav) => {
                const isCollection = nav.type.includes('Collection(');
                const itemColorClass = isCollection ? "text-blue-600" : "text-emerald-600";
                const iconColorClass = isCollection ? "text-blue-400" : "text-emerald-400";

                return (
                <div 
                    key={nav.name} 
                    // 重要：设置 magnet="true" 让 X6 知道这是一个可以引出连线的端口
                    // 设置 port-id 方便后续识别（虽然我们主要用 layout 自动连）
                    magnet="true"
                    id={`nav-${nav.name}`}
                    className="relative flex items-center justify-between px-3 py-1.5 hover:bg-white hover:shadow-inner transition-colors cursor-pointer group border-l-2 border-transparent hover:border-indigo-400"
                >
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

export default EntityNode;
