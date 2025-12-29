import React from 'react';
import { Key, Table2, Braces, Hash, Type } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  node?: any;
  entity?: ODataEntity;
}

const EntityNode: React.FC<EntityNodeProps> = ({ node, entity: propEntity }) => {
  const entity: ODataEntity = node ? node.getData()?.entity : propEntity;

  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  // 限制显示数量，避免节点过长
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  return (
    <div className="w-full h-full font-sans text-sm bg-white rounded-lg shadow-lg border border-slate-200 flex flex-col overflow-hidden hover:shadow-xl hover:ring-2 hover:ring-indigo-400/50 transition-all duration-300 group">
      
      {/* 头部：深色渐变背景 */}
      <div 
        className="bg-gradient-to-r from-slate-800 to-slate-700 p-2.5 flex justify-between items-center text-white cursor-move relative overflow-hidden"
      >
          {/* 装饰性光泽 */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10"></div>
          
          <div className="flex items-center gap-2.5 overflow-hidden z-10">
              <div className="p-1 bg-white/10 rounded-md shadow-inner backdrop-blur-sm">
                <Table2 className="w-3.5 h-3.5 text-indigo-200" />
              </div>
              <span className="font-semibold tracking-wide truncate text-[13px] text-shadow-sm" title={entity.name}>
                {entity.name}
              </span>
          </div>
          
          {entity.navigationProperties.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-900/50 px-2 py-0.5 rounded-full border border-white/5 backdrop-blur-md">
                  <Braces className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-100 font-mono font-bold">
                      {entity.navigationProperties.length}
                  </span>
              </div>
          )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
          
          {/* 主键区域 (PK) */}
          {keyProperties.length > 0 && (
            <div className="bg-white border-b border-slate-100">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="flex items-center justify-between px-3 py-2 bg-amber-50/40 border-l-[3px] border-amber-400 hover:bg-amber-50 transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-500 fill-amber-500/20" />
                        <span className="font-medium text-slate-800 truncate text-xs">{prop.name}</span>
                    </div>
                    <span className="text-[9px] text-amber-600/80 font-mono bg-amber-100/50 px-1 rounded ml-2">PK</span>
                </div>
            ))}
            </div>
          )}

          {/* 普通属性列表 */}
          <div className="flex-col">
            {visibleProps.map((prop, index) => (
            <div 
                key={prop.name} 
                className={`flex items-center justify-between px-3 py-1.5 border-l-[3px] border-transparent hover:border-slate-300 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
            >
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <Hash className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
                    <span className="truncate text-slate-600 text-xs" title={prop.name}>{prop.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 bg-slate-100 px-1 rounded max-w-[80px] truncate" title={prop.type}>
                    {prop.type.split('.').pop()}
                </span>
            </div>
            ))}
            
            {hiddenCount > 0 && (
                <div className="px-3 py-1.5 text-center bg-slate-100/50 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                        + {hiddenCount} more properties
                    </span>
                </div>
            )}
          </div>

          {/* 导航属性 (Foreign Keys / Relations) */}
          {entity.navigationProperties.length > 0 && (
            <div className="mt-auto border-t border-slate-200 bg-white">
                <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Braces className="w-2.5 h-2.5" /> Relations
                </div>
                <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
                    {entity.navigationProperties.map((nav) => {
                        const isCollection = nav.type.includes('Collection(');
                        
                        return (
                        <div 
                            key={nav.name} 
                            magnet="true"
                            id={`nav-${nav.name}`}
                            className="group/nav relative flex items-center justify-between px-3 py-1.5 hover:bg-indigo-50 cursor-pointer transition-colors border-l-[3px] border-transparent hover:border-indigo-400"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCollection ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                                <span className="truncate font-medium text-xs text-slate-700 group-hover/nav:text-indigo-700 transition-colors" title={nav.name}>
                                    {nav.name}
                                </span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-mono border ${
                                isCollection 
                                ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                {isCollection ? '1:N' : '1:1'}
                            </span>
                        </div>
                        );
                    })}
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default EntityNode;