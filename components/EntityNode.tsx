import React from 'react';
import { Key, Table2, Braces, Hash } from 'lucide-react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  node?: any;
  entity?: ODataEntity;
}

// 这里的样式高度必须与 ERDiagram.tsx 中的计算逻辑保持严格一致
// Header: 42px
// PK Row: 32px
// Prop Row: 28px
// Nav Header: 28px
// Nav Row: 28px

const EntityNode: React.FC<EntityNodeProps> = ({ node, entity: propEntity }) => {
  const entity: ODataEntity = node ? node.getData()?.entity : propEntity;

  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  // 限制显示数量
  const MAX_VISIBLE_PROPS = 8;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  return (
    <div className="w-full h-full font-sans text-sm bg-white rounded-lg shadow-md border border-slate-300 flex flex-col overflow-hidden hover:shadow-xl hover:border-indigo-400 transition-all duration-300 group">
      
      {/* 1. Header: 固定高度 42px */}
      <div 
        className="h-[42px] bg-slate-100 border-b border-slate-200 px-3 flex justify-between items-center relative overflow-hidden shrink-0"
      >
          <div className="flex items-center gap-2 overflow-hidden z-10">
              <Table2 className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-slate-700 truncate text-[13px]" title={entity.name}>
                {entity.name}
              </span>
          </div>
          
          {entity.navigationProperties.length > 0 && (
              <div className="flex items-center justify-center bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">
                  <span className="text-[10px] text-slate-500 font-mono font-bold">
                      {entity.navigationProperties.length}
                  </span>
              </div>
          )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 bg-white flex flex-col min-h-0">
          
          {/* 2. 主键区域 (PK): 每行 32px */}
          {keyProperties.length > 0 && (
            <div className="bg-white border-b border-slate-100">
            {keyProperties.map((prop) => (
                <div key={prop.name} className="h-[32px] flex items-center justify-between px-3 bg-amber-50/50 border-l-[3px] border-amber-400">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Key className="w-3 h-3 flex-shrink-0 text-amber-500" />
                        <span className="font-semibold text-slate-800 truncate text-xs">{prop.name}</span>
                    </div>
                    <span className="text-[9px] text-amber-600 font-mono">PK</span>
                </div>
            ))}
            </div>
          )}

          {/* 3. 普通属性列表: 每行 28px */}
          <div className="flex-col">
            {visibleProps.map((prop, index) => (
            <div 
                key={prop.name} 
                className={`h-[28px] flex items-center justify-between px-3 border-l-[3px] border-transparent ${index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}
            >
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <span className="truncate text-slate-600 text-xs" title={prop.name}>{prop.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 truncate max-w-[80px]" title={prop.type}>
                    {prop.type.split('.').pop()}
                </span>
            </div>
            ))}
            
            {/* More Row: 28px */}
            {hiddenCount > 0 && (
                <div className="h-[28px] flex items-center justify-center bg-slate-50 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 italic">
                        ... {hiddenCount} more properties
                    </span>
                </div>
            )}
          </div>

          {/* 4. 导航属性区域 */}
          {entity.navigationProperties.length > 0 && (
            <div className="mt-auto border-t border-slate-200 bg-white">
                {/* 导航标题: 28px */}
                <div className="h-[28px] px-3 bg-slate-50 border-b border-slate-100 flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Navigation</span>
                </div>
                
                {/* 导航行: 每行 28px */}
                <div className="">
                    {entity.navigationProperties.map((nav) => {
                        const isCollection = nav.type.includes('Collection(');
                        return (
                        <div 
                            key={nav.name} 
                            // 移除 ID，完全依赖端口
                            className="h-[28px] group/nav relative flex items-center justify-between px-3 hover:bg-indigo-50 transition-colors border-l-[3px] border-transparent hover:border-indigo-400"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCollection ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                                <span className="truncate font-medium text-xs text-slate-700 group-hover/nav:text-indigo-700 transition-colors" title={nav.name}>
                                    {nav.name}
                                </span>
                            </div>
                            <span className={`text-[9px] px-1 rounded-sm font-mono ${
                                isCollection ? 'text-blue-500' : 'text-emerald-500'
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