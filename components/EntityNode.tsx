import React from 'react';
import { ODataEntity } from '../types';

interface EntityNodeProps {
  node?: any;
  entity?: ODataEntity;
}

// 样式常量 - 必须与 ERDiagram.tsx 中的计算逻辑完全一致
// Header: 36px
// Row: 26px
// Section Header: 24px

const EntityNode: React.FC<EntityNodeProps> = ({ node, entity: propEntity }) => {
  const entity: ODataEntity = node ? node.getData()?.entity : propEntity;

  if (!entity) return null;

  const keyProperties = entity.properties.filter(p => entity.keys.includes(p.name));
  const otherProperties = entity.properties.filter(p => !entity.keys.includes(p.name));
  
  // 限制显示属性数量
  const MAX_VISIBLE_PROPS = 10;
  const visibleProps = otherProperties.slice(0, MAX_VISIBLE_PROPS);
  const hiddenCount = otherProperties.length - MAX_VISIBLE_PROPS;

  return (
    <div className="w-full h-full font-sans text-xs bg-white rounded shadow-sm border border-slate-400 flex flex-col overflow-hidden box-border">
      
      {/* 1. Header (36px) */}
      <div className="h-[36px] bg-slate-100 border-b border-slate-300 px-2 flex items-center justify-between shrink-0">
          <span className="font-bold text-slate-800 truncate" title={entity.name}>
            {entity.name}
          </span>
          {entity.navigationProperties.length > 0 && (
             <span className="text-[10px] bg-white border border-slate-300 px-1 rounded text-slate-500">
                {entity.navigationProperties.length}
             </span>
          )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 bg-white flex flex-col min-h-0">
          
          {/* 2. 主键区域 (每行 26px) */}
          {keyProperties.map((prop) => (
            <div key={prop.name} className="h-[26px] flex items-center justify-between px-2 bg-amber-50/50 border-b border-slate-100">
                <span className="font-bold text-slate-800 truncate flex-1 mr-2">{prop.name}</span>
                <div className="flex items-center shrink-0">
                    <span className="text-[10px] text-slate-400 mr-1">{prop.type.split('.').pop()}</span>
                    <span className="text-[9px] text-amber-700 font-mono">PK</span>
                </div>
            </div>
          ))}

          {/* 3. 普通属性 (每行 26px) */}
          {visibleProps.map((prop, index) => (
            <div key={prop.name} className={`h-[26px] flex items-center justify-between px-2 border-b border-slate-50 ${index % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                <span className="truncate text-slate-700 flex-1 mr-2" title={prop.name}>{prop.name}</span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 max-w-[80px] truncate" title={prop.type}>
                    {prop.type.split('.').pop()}
                </span>
            </div>
          ))}
          
          {hiddenCount > 0 && (
              <div className="h-[26px] flex items-center justify-center bg-slate-50 border-b border-slate-100">
                  <span className="text-[10px] text-slate-400 italic">... {hiddenCount} more</span>
              </div>
          )}

          {/* 4. 导航区域 */}
          {entity.navigationProperties.length > 0 && (
            <div className="mt-0">
                {/* Section Header (24px) */}
                <div className="h-[24px] bg-slate-100 px-2 flex items-center border-b border-slate-200 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Navigation</span>
                </div>
                
                {/* 导航行 (每行 26px) */}
                {entity.navigationProperties.map((nav) => {
                    const isCollection = nav.type.includes('Collection(');
                    return (
                    <div 
                        key={nav.name} 
                        className="h-[26px] flex items-center justify-between px-2 hover:bg-slate-100 relative group"
                    >
                        <span className="truncate font-medium text-indigo-700 flex-1 mr-2" title={nav.name}>
                            {nav.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono border border-slate-200 px-1 rounded bg-white">
                            {isCollection ? '1:N' : '1:1'}
                        </span>
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